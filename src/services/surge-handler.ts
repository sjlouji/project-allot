import { Order, Rider, SurgeLevel, SurgeState, SurgeConfig, ScoringWeights } from '../types';

export class SurgeHandler {
  private currentLevel: SurgeLevel = 'normal';

  constructor(private config: SurgeConfig) {}

  public detectSurge(
    pendingOrders: number,
    availableRiders: number,
    activeBatchCapacity: number
  ): SurgeState {
    const availableCapacity = availableRiders * activeBatchCapacity;
    const demandSupplyRatio = pendingOrders / Math.max(availableCapacity, 1);

    let level: SurgeLevel = 'normal';
    const recommendedActions: string[] = [];

    if (demandSupplyRatio >= this.config.crisisRatio) {
      level = 'crisis';
      recommendedActions.push('escalate_sla_windows');
      recommendedActions.push('notify_customers');
      recommendedActions.push('activate_emergency_protocol');
      recommendedActions.push('request_additional_supply');
    } else if (demandSupplyRatio >= this.config.hardSurgeRatio) {
      level = 'hard_surge';
      recommendedActions.push('enable_preposioning');
      recommendedActions.push('hold_sla_orders');
      recommendedActions.push('increase_batch_sizes');
      recommendedActions.push('expand_search_radius');
    } else if (demandSupplyRatio >= this.config.softSurgeRatio) {
      level = 'soft_surge';
      recommendedActions.push('increase_batch_sizes_by_1');
      recommendedActions.push('expand_candidate_radius_50pct');
      recommendedActions.push('reduce_fairness_weight');
    }

    this.currentLevel = level;

    return {
      level,
      demandSupplyRatio,
      pendingOrderCount: pendingOrders,
      availableCapacity,
      recommendedActions,
    };
  }

  public getCurrentLevel(): SurgeLevel {
    return this.currentLevel;
  }

  public applySoftSurgeModifications(
    baseWeights: ScoringWeights,
    baseBatchSizes: Record<string, number>,
    baseRadiusKm: number
  ): {
    weights: ScoringWeights;
    batchSizes: Record<string, number>;
    radiusKm: number;
  } {
    const weights = { ...baseWeights };
    weights.w5_workload = Math.max(0, weights.w5_workload * 0.5);

    weights.w2_slaRisk = Math.min(1.0, weights.w2_slaRisk * 1.2);

    const batchSizes: Record<string, number> = {};
    for (const [vType, size] of Object.entries(baseBatchSizes)) {
      batchSizes[vType] = size + this.config.batchSizeIncrement;
    }
    const radiusKm = baseRadiusKm * this.config.radiusExpansionFactor;

    return { weights, batchSizes, radiusKm };
  }

  public applyHardSurgeModifications(
    baseWeights: ScoringWeights,
    baseBatchSizes: Record<string, number>,
    baseRadiusKm: number,
    orders: Map<string, Order>,
    riders: Map<string, Rider>
  ): {
    weights: ScoringWeights;
    batchSizes: Record<string, number>;
    radiusKm: number;
    heldOrders: string[];
    prepositioningTargets: { riderId: string; targetLocation: { lat: number; lng: number } }[];
  } {
    const weights = { ...baseWeights };
    weights.w5_workload = 0;
    weights.w2_slaRisk = 0.5;
    weights.w1_time = 0.3;
    weights.w3_distance = 0.2;

    const batchSizes: Record<string, number> = {};
    for (const [vType, size] of Object.entries(baseBatchSizes)) {
      batchSizes[vType] = size + this.config.batchSizeIncrement * 2;
    }

    const radiusKm = baseRadiusKm * Math.pow(this.config.radiusExpansionFactor, 2);
    const heldOrders: string[] = [];
    const now = new Date();
    for (const [orderId, order] of orders) {
      const slaCutoff = new Date(now.getTime() + 30 * 60 * 1000);
      if (order.priority === 'normal' && order.slaDeadline > slaCutoff) {
        heldOrders.push(orderId);
      }
    }

    const prepositioningTargets = this.calculatePrepositioningTargets(orders, riders);

    return { weights, batchSizes, radiusKm, heldOrders, prepositioningTargets };
  }

  public applyCrisisModifications(): {
    algorithm: 'greedy';
    skipGlobalOptimization: boolean;
    enableEmergencyMode: boolean;
    notifyOps: boolean;
  } {
    return {
      algorithm: 'greedy',
      skipGlobalOptimization: true,
      enableEmergencyMode: true,
      notifyOps: true,
    };
  }

  /**
   * Calculate preposioning targets for idle riders
   * Moves riders toward anticipated high-demand zones
   */
  private calculatePrepositioningTargets(
    orders: Map<string, Order>,
    riders: Map<string, Rider>
  ): { riderId: string; targetLocation: { lat: number; lng: number } }[] {
    const targets: { riderId: string; targetLocation: { lat: number; lng: number } }[] = [];

    const idleRiders = Array.from(riders.values()).filter(
      r => r.status === 'active' && r.currentAssignments.length === 0
    );

    if (idleRiders.length === 0) {
      return targets;
    }

    const ordersByZone = this.groupOrdersByZone(orders);

    const zoneCentroids = this.calculateZoneCentroids(ordersByZone);

    const sortedZones = Array.from(zoneCentroids.entries())
      .sort(([, a], [, b]) => b.orderCount - a.orderCount);

    for (let i = 0; i < idleRiders.length && i < sortedZones.length; i++) {
      const [, { centroid }] = sortedZones[i];
      targets.push({
        riderId: idleRiders[i].riderId,
        targetLocation: centroid,
      });
    }

    return targets;
  }

  private groupOrdersByZone(orders: Map<string, Order>): Map<string, Order[]> {
    const zones = new Map<string, Order[]>();

    for (const [, order] of orders) {
      const zone = this.getOrderZone(order.delivery.location);
      if (!zones.has(zone)) {
        zones.set(zone, []);
      }
      zones.get(zone)!.push(order);
    }

    return zones;
  }

  private getOrderZone(location: { lat: number; lng: number }): string {
    const latBucket = Math.floor(location.lat / 0.5);
    const lngBucket = Math.floor(location.lng / 0.5);
    return `${latBucket}_${lngBucket}`;
  }

  private calculateZoneCentroids(
    zones: Map<string, Order[]>
  ): Map<string, { centroid: { lat: number; lng: number }; orderCount: number }> {
    const centroids = new Map<string, { centroid: { lat: number; lng: number }; orderCount: number }>();

    for (const [zone, orders] of zones) {
      const avgLat =
        orders.reduce((sum, o) => sum + o.delivery.location.lat, 0) / orders.length;
      const avgLng =
        orders.reduce((sum, o) => sum + o.delivery.location.lng, 0) / orders.length;

      centroids.set(zone, {
        centroid: { lat: avgLat, lng: avgLng },
        orderCount: orders.length,
      });
    }

    return centroids;
  }
}
