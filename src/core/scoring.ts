import {
  Order,
  Rider,
  ScoringResult,
  AssignmentCostBreakdown,
  ScoringWeights,
  RouteStop,
} from '../types';
import { ETAModel } from '../models/eta-model';
import { haversineDistance } from '../utils/geospatial';

export class Scorer {
  private etaModel: ETAModel;

  constructor(
    private weights: ScoringWeights,
    etaModel: ETAModel,
    private slaRiskSigmoidScale: number = 10
  ) {
    this.etaModel = etaModel;
  }

  public scoreAssignment(
    order: Order,
    rider: Rider,
    now: Date
  ): ScoringResult {
    const breakdown: AssignmentCostBreakdown = {
      deltaTimeCost: 0,
      slaRiskCost: 0,
      distanceCost: 0,
      batchDisruptionCost: 0,
      workloadImbalanceCost: 0,
      affinityCost: 0,
      totalWeightedCost: 0,
    };

    breakdown.deltaTimeCost = this.calculateDeltaTimeCost(order, rider, now);
    breakdown.slaRiskCost = this.calculateSLARiskCost(order, rider, now);
    breakdown.distanceCost = this.calculateDistanceCost(order, rider);
    breakdown.batchDisruptionCost = this.calculateBatchDisruptionCost(rider);
    breakdown.workloadImbalanceCost = this.calculateWorkloadImbalanceCost(rider);
    breakdown.affinityCost = this.calculateAffinityCost(order, rider);

    breakdown.totalWeightedCost =
      this.weights.w1_time * breakdown.deltaTimeCost +
      this.weights.w2_slaRisk * breakdown.slaRiskCost +
      this.weights.w3_distance * breakdown.distanceCost +
      this.weights.w4_batchDisruption * breakdown.batchDisruptionCost +
      this.weights.w5_workload * breakdown.workloadImbalanceCost +
      this.weights.w6_affinity * breakdown.affinityCost;

    return {
      orderId: order.orderId,
      riderId: rider.riderId,
      cost: breakdown.totalWeightedCost,
      costBreakdown: breakdown,
    };
  }

  private calculateDeltaTimeCost(order: Order, rider: Rider, now: Date): number {
    if (rider.currentAssignments.length === 0) {
      const etaPickup = this.etaModel.estimateETA(
        rider.location,
        order.pickup.location,
        now,
        rider.riderId
      );
      const etaDelivery = this.etaModel.estimateETA(
        order.pickup.location,
        order.delivery.location,
        new Date(now.getTime() + etaPickup.estimatedDurationMinutes * 60 * 1000),
        rider.riderId
      );
      const totalMinutes = etaPickup.estimatedDurationMinutes + etaDelivery.estimatedDurationMinutes;
      return Math.min(1.0, totalMinutes / 120);
    } else {
      const insertionCost = this.calculateInsertionCost(order, rider);
      return Math.min(1.0, insertionCost / 60);
    }
  }

  private calculateInsertionCost(order: Order, rider: Rider): number {
    if (rider.currentRoute.length < 2) {
      return 0;
    }

    let minInsertionCost = Infinity;

    for (let insertPos = 0; insertPos < rider.currentRoute.length; insertPos++) {
      const prevStop = insertPos === 0 ? this.getCurrentLocation(rider) : rider.currentRoute[insertPos - 1];
      const nextStop = rider.currentRoute[insertPos];

      const distanceToPickup = haversineDistance(prevStop.location, order.pickup.location);
      const distancePickupToNext = haversineDistance(order.pickup.location, nextStop.location);
      const directDistance = haversineDistance(prevStop.location, nextStop.location);

      const detourCost = distanceToPickup + distancePickupToNext - directDistance;

      const deliveryDetourPenalty = 10;

      const insertionCostAtPos = detourCost + deliveryDetourPenalty;

      if (insertionCostAtPos < minInsertionCost) {
        minInsertionCost = insertionCostAtPos;
      }
    }

    return minInsertionCost > Infinity ? 0 : minInsertionCost;
  }

  private getCurrentLocation(rider: Rider): RouteStop {
    if (rider.currentRoute.length === 0) {
      return {
        type: 'pickup',
        orderId: '',
        location: rider.location,
        sequenceIndex: 0,
      };
    }
    return rider.currentRoute[rider.currentRoute.length - 1];
  }

  private calculateSLARiskCost(order: Order, rider: Rider, now: Date): number {
    const eta = this.etaModel.estimateETA(
      rider.location,
      order.delivery.location,
      now,
      rider.riderId
    );

    const estimatedDeliveryTime = new Date(now.getTime() + eta.estimatedDurationMinutes * 60 * 1000);
    const slackMinutes = (order.slaDeadline.getTime() - estimatedDeliveryTime.getTime()) / 60000;

    const riskProbability = 1 / (1 + Math.exp(slackMinutes / this.slaRiskSigmoidScale));

    return Math.max(0, Math.min(1, riskProbability));
  }

  private calculateDistanceCost(order: Order, rider: Rider): number {
    const distanceKm = haversineDistance(rider.location, order.pickup.location);
    return Math.min(1.0, distanceKm / 20);
  }

  private calculateBatchDisruptionCost(rider: Rider): number {
    if (rider.currentRoute.length === 0) {
      return 0;
    }

    const estimatedAddedDurationMinutes = 20;

    let totalSLARiskIncrease = 0;

    for (const _ of rider.currentAssignments) {
      if (estimatedAddedDurationMinutes > 15) {
        totalSLARiskIncrease += 0.2;
      }
    }

    return Math.min(1.0, totalSLARiskIncrease);
  }

  private calculateWorkloadImbalanceCost(rider: Rider): number {
    const loadScore = (rider.load.weightKg / rider.vehicle.maxWeightKg) * 0.7 +
                      (rider.load.itemCount / rider.vehicle.maxItems) * 0.3;

    if (loadScore < 0.7) {
      return 0;
    }

    return Math.min(1.0, (loadScore - 0.7) / 0.3);
  }

  private calculateAffinityCost(order: Order, rider: Rider): number {
    let affinityScore = 0;

    const deliveryZone = this.getDeliveryZone(order.delivery.location);
    const zoneFamiliarity = rider.performance.zoneFamiliarityScores[deliveryZone] || 0.5;
    affinityScore += zoneFamiliarity * 0.5;

    affinityScore += rider.performance.avgDeliverySuccessRate * 0.3;

    const speedBonus = Math.max(0, rider.performance.avgSpeedMultiplier - 0.9) * 0.2;
    affinityScore += speedBonus;

    return -(affinityScore / 1.0);
  }

  private getDeliveryZone(location: { lat: number; lng: number }): string {
    const zoneLatBucket = Math.floor(location.lat / 0.5);
    const zoneLngBucket = Math.floor(location.lng / 0.5);
    return `zone_${zoneLatBucket}_${zoneLngBucket}`;
  }
}
