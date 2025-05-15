import {
  Order,
  Rider,
  Assignment,
  ReassignmentTrigger,
  ReassignmentConfig,
} from '../types';
import { estimateTravelTime, haversineDistance } from '../utils/geospatial';

export class ReassignmentEngine {
  private reassignmentCounts: Map<string, number> = new Map();
  private lastReassignmentTime: Map<string, Date> = new Map();

  constructor(private config: ReassignmentConfig) {}

  public detectTriggers(
    orders: Map<string, Order>,
    riders: Map<string, Rider>,
    assignments: Map<string, Assignment>,
    now: Date
  ): ReassignmentTrigger[] {
    const triggers: ReassignmentTrigger[] = [];

    triggers.push(...this.detectOfflineRiders(riders, assignments, now));

    triggers.push(...this.detectETASpikes(orders, assignments, riders, now));

    triggers.push(...this.detectHighPriorityArrivals(orders, assignments, riders, now));

    triggers.push(...this.detectNewRidersInDemandZones(riders, now));

    return triggers;
  }

  /**
   * Trigger 1: Detect riders that have gone offline
   */
  private detectOfflineRiders(
    riders: Map<string, Rider>,
    assignments: Map<string, Assignment>,
    now: Date
  ): ReassignmentTrigger[] {
    const triggers: ReassignmentTrigger[] = [];
    const affectedOrders: Set<string> = new Set();

    for (const [, assignment] of assignments) {
      const rider = riders.get(assignment.riderId);
      if (!rider || rider.status === 'offline') {
        affectedOrders.add(assignment.orderId);
      }
    }

    if (affectedOrders.size > 0) {
      triggers.push({
        type: 'rider_offline',
        affectedOrderIds: Array.from(affectedOrders),
        affectedRiderIds: Array.from(affectedOrders)
          .map(orderId => assignments.get(orderId)?.riderId || '')
          .filter(Boolean),
        reason: 'One or more assigned riders went offline',
        timestamp: now,
      });
    }

    return triggers;
  }

  private detectETASpikes(
    orders: Map<string, Order>,
    assignments: Map<string, Assignment>,
    riders: Map<string, Rider>,
    now: Date
  ): ReassignmentTrigger[] {
    const triggers: ReassignmentTrigger[] = [];
    const affectedOrders: Set<string> = new Set();

    for (const [, assignment] of assignments) {
      const order = orders.get(assignment.orderId);
      const rider = riders.get(assignment.riderId);

      if (!order || !rider) continue;

      const currentEta = estimateTravelTime(
        rider.location,
        order.delivery.location,
        25,
        1.2
      );

      const originalEta = assignment.estimatedDeliveryAt.getTime() - assignment.assignedAt.getTime();
      const etaIncreaseMinutes = currentEta - originalEta / 60000;

      if (etaIncreaseMinutes > this.config.triggerEtaSpikeMinutes) {
        affectedOrders.add(assignment.orderId);
      }
    }

    if (affectedOrders.size > 0) {
      triggers.push({
        type: 'eta_spike',
        affectedOrderIds: Array.from(affectedOrders),
        affectedRiderIds: [],
        reason: `${affectedOrders.size} orders experienced significant ETA increases`,
        timestamp: now,
      });
    }

    return triggers;
  }

  private detectHighPriorityArrivals(
    orders: Map<string, Order>,
    assignments: Map<string, Assignment>,
    riders: Map<string, Rider>,
    now: Date
  ): ReassignmentTrigger[] {
    const triggers: ReassignmentTrigger[] = [];
    const affectedOrders: Set<string> = new Set();
    const affectedRiders: Set<string> = new Set();

    const priorityOrders = Array.from(orders.values()).filter(
      o => o.priority === 'critical' || (o.priority === 'high' && !assignments.has(o.orderId))
    );

    for (const order of priorityOrders) {
      const slaCutoffTime = new Date(now.getTime() + this.config.triggerHighPrioritySlaCutoffMinutes * 60 * 1000);

      if (order.slaDeadline <= slaCutoffTime) {
        for (const [, assignment] of assignments) {
          const assignedOrder = orders.get(assignment.orderId);
          const rider = riders.get(assignment.riderId);

          if (assignedOrder && assignedOrder.priority === 'normal' && rider) {
            const distanceToPriority = haversineDistance(rider.location, order.pickup.location);
            if (distanceToPriority < 3) {
              affectedOrders.add(order.orderId);
              affectedRiders.add(rider.riderId);
            }
          }
        }
      }
    }

    if (affectedOrders.size > 0) {
      triggers.push({
        type: 'high_priority_arrival',
        affectedOrderIds: Array.from(affectedOrders),
        affectedRiderIds: Array.from(affectedRiders),
        reason: `${affectedOrders.size} high-priority orders need immediate assignment`,
        timestamp: now,
      });
    }

    return triggers;
  }

  private detectNewRidersInDemandZones(
    riders: Map<string, Rider>,
    now: Date
  ): ReassignmentTrigger[] {
    const triggers: ReassignmentTrigger[] = [];

    const idleRiders = Array.from(riders.values()).filter(
      r => r.status === 'active' && r.currentAssignments.length === 0
    );

    if (idleRiders.length > 0) {
      triggers.push({
        type: 'new_rider_online',
        affectedOrderIds: [],
        affectedRiderIds: idleRiders.map(r => r.riderId),
        reason: `${idleRiders.length} idle riders available for assignment`,
        timestamp: now,
      });
    }

    return triggers;
  }

  public canReassign(orderId: string): boolean {
    const count = this.reassignmentCounts.get(orderId) || 0;
    if (count >= this.config.maxReassignmentAttempts) {
      return false;
    }

    const lastTime = this.lastReassignmentTime.get(orderId);
    if (lastTime) {
      const timeSinceLastMs = Date.now() - lastTime.getTime();
      const minIntervalMs = 30000;
      if (timeSinceLastMs < minIntervalMs) {
        return false;
      }
    }

    return true;
  }

  public isReassignmentSuppressed(rider: Rider, pickupLocation: { lat: number; lng: number }): boolean {
    const distance = haversineDistance(rider.location, pickupLocation);
    return distance < this.config.suppressionRadiusMeters / 1000;
  }

  public recordReassignment(orderId: string): void {
    const count = this.reassignmentCounts.get(orderId) || 0;
    this.reassignmentCounts.set(orderId, count + 1);
    this.lastReassignmentTime.set(orderId, new Date());
  }

  public getStats(): {
    totalOrdersReassigned: number;
    avgReassignmentsPerOrder: number;
    ordersExceededMax: number;
  } {
    const total = this.reassignmentCounts.size;
    const sum = Array.from(this.reassignmentCounts.values()).reduce((a, b) => a + b, 0);
    const exceededMax = Array.from(this.reassignmentCounts.values()).filter(
      count => count >= this.config.maxReassignmentAttempts
    ).length;

    return {
      totalOrdersReassigned: total,
      avgReassignmentsPerOrder: total === 0 ? 0 : sum / total,
      ordersExceededMax: exceededMax,
    };
  }
}
