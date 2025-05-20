import {
  Order,
  Rider,
  CandidateGenerationResult,
  CandidateGenerationConfig,
  FatigueConfig,
} from '../types';
import {
  findRidersWithinRadius,
  estimateTravelTime,
} from '../utils/geospatial';

export class CandidateGenerator {
  private riderLocations: Map<string, { lat: number; lng: number }>;

  constructor(private config: CandidateGenerationConfig, private fatigueConfig: FatigueConfig) {
    this.riderLocations = new Map();
  }

  public updateRiderLocations(riders: Map<string, Rider>): void {
    this.riderLocations.clear();
    for (const [riderId, rider] of riders) {
      this.riderLocations.set(riderId, rider.location);
    }
  }

  public generateCandidates(
    order: Order,
    riders: Map<string, Rider>,
    now: Date
  ): CandidateGenerationResult {
    const candidates: string[] = [];
    const eligibilityChecks = new Map<string, string[]>();

    const candidatesByRadius = this.geographicFilter(order, now);

    if (candidatesByRadius.length === 0) {
      return {
        orderId: order.orderId,
        candidateRiderIds: [],
        failureReason: 'no_riders_in_service_radius',
      };
    }

    for (const riderId of candidatesByRadius) {
      const rider = riders.get(riderId);
      if (!rider) continue;

      const checkResults = this.runHardConstraints(order, rider, now);

      if (checkResults.passed) {
        candidates.push(riderId);
      } else {
        eligibilityChecks.set(riderId, checkResults.failedConstraints);
      }
    }

    if (candidates.length === 0) {
      return {
        orderId: order.orderId,
        candidateRiderIds: [],
        failureReason: 'all_riders_failed_constraints',
      };
    }

    return {
      orderId: order.orderId,
      candidateRiderIds: candidates,
    };
  }

  private geographicFilter(order: Order, now: Date): string[] {
    const slaMinutesRemaining = (order.slaDeadline.getTime() - now.getTime()) / 60000;

    let searchRadiusKm = this.config.initialRadiusKm;

    if (slaMinutesRemaining < this.config.radiusExpansionMinutesThreshold) {
      const allCandidates = findRidersWithinRadius(order.pickup.location, this.riderLocations, this.config.maxRadiusKm);
      return allCandidates;
    }

    let candidates = findRidersWithinRadius(
      order.pickup.location,
      this.riderLocations,
      searchRadiusKm
    );

    if (candidates.length === 0 && searchRadiusKm < this.config.expandedRadiusKm) {
      searchRadiusKm = this.config.expandedRadiusKm;
      candidates = findRidersWithinRadius(
        order.pickup.location,
        this.riderLocations,
        searchRadiusKm
      );
    }

    if (candidates.length === 0 && searchRadiusKm < this.config.maxRadiusKm) {
      searchRadiusKm = this.config.maxRadiusKm;
      candidates = findRidersWithinRadius(
        order.pickup.location,
        this.riderLocations,
        searchRadiusKm
      );
    }

    return candidates;
  }

  private runHardConstraints(
    order: Order,
    rider: Rider,
    now: Date
  ): { passed: boolean; failedConstraints: string[] } {
    const failures: string[] = [];

    if (!this.capacityCheck(order, rider)) {
      failures.push('capacity_exceeded');
    }

    if (!this.vehicleCompatibilityCheck(order, rider)) {
      failures.push('vehicle_incompatible');
    }

    if (!this.shiftTimeCheck(order, rider, now)) {
      failures.push('shift_end_time');
    }

    if (!this.fatigueCheck(rider)) {
      failures.push('fatigue_limit_exceeded');
    }

    if (!this.slaFeasibilityCheck(order, rider, now)) {
      failures.push('sla_infeasible');
    }

    if (!this.riderStatusCheck(rider)) {
      failures.push('rider_offline_or_unavailable');
    }

    return {
      passed: failures.length === 0,
      failedConstraints: failures,
    };
  }

  private capacityCheck(order: Order, rider: Rider): boolean {
    const remainingWeight = rider.vehicle.maxWeightKg - rider.load.weightKg;
    const remainingVolume = rider.vehicle.maxVolumeLiters - rider.load.volumeLiters;
    const remainingItems = rider.vehicle.maxItems - rider.load.itemCount;

    return (
      remainingWeight >= order.payload.weightKg &&
      remainingVolume >= order.payload.volumeLiters &&
      remainingItems >= order.payload.itemCount
    );
  }

  private vehicleCompatibilityCheck(order: Order, rider: Rider): boolean {
    const requirement = order.payload.vehicleRequirement;

    if (requirement === 'any') {
      return true;
    }

    if (requirement === 'bike' || requirement === 'car' || requirement === 'van') {
      return rider.vehicle.type === requirement;
    }

    if (requirement === 'refrigerated') {
      return rider.vehicle.capabilities.includes('cold_chain');
    }

    if (order.payload.fragile && !rider.vehicle.capabilities.includes('fragile')) {
      return false;
    }

    if (order.payload.requiresColdChain && !rider.vehicle.capabilities.includes('cold_chain')) {
      return false;
    }

    return true;
  }

  private shiftTimeCheck(order: Order, rider: Rider, now: Date): boolean {
    const timeToPickupMinutes = estimateTravelTime(
      rider.location,
      order.pickup.location,
      25,
      1.2
    );

    const pickupServiceMinutes = order.pickup.estimatedPickupWaitMinutes;

    const timeToDeliveryMinutes = estimateTravelTime(
      order.pickup.location,
      order.delivery.location,
      25,
      1.2
    );

    const deliveryServiceMinutes = 3;

    const totalTimeNeeded =
      timeToPickupMinutes + pickupServiceMinutes + timeToDeliveryMinutes + deliveryServiceMinutes;

    const shiftTimeAvailableMinutes =
      (rider.shift.endTime.getTime() - now.getTime()) / 60000;

    return shiftTimeAvailableMinutes >= totalTimeNeeded + 5;
  }

  private fatigueCheck(rider: Rider): boolean {
    return (
      rider.shift.continuousDrivingMinutes < this.fatigueConfig.maxContinuousDrivingMinutes &&
      rider.shift.totalShiftDrivingMinutes < this.fatigueConfig.maxShiftDrivingMinutes
    );
  }

  private slaFeasibilityCheck(order: Order, rider: Rider, now: Date): boolean {
    const minTimeMinutes =
      estimateTravelTime(rider.location, order.pickup.location, 25, 1.0) +
      order.pickup.estimatedPickupWaitMinutes +
      estimateTravelTime(order.pickup.location, order.delivery.location, 25, 1.0) +
      3;

    const minDeliveryTime = new Date(now.getTime() + minTimeMinutes * 60 * 1000);
    return minDeliveryTime <= order.slaDeadline;
  }

  private riderStatusCheck(rider: Rider): boolean {
    return rider.status === 'active' || rider.status === 'on_delivery';
  }
}
