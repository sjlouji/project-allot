import {
  Order,
  Rider,
  AssignmentEngineConfig,
  AssignmentEngineState,
  AssignmentCycleResult,
  AssignmentDecision,
  ScoringResult,
} from '../types';
import { CandidateGenerator } from '../core/candidate-generation';
import { Scorer } from '../core/scoring';
import { AdaptiveOptimizer, AssignmentMatrix } from '../algorithms/optimizers';
import { ETAModel } from '../models/eta-model';
import { ReassignmentEngine } from '../services/reassignment-engine';
import { SurgeHandler } from '../services/surge-handler';

export class AssignmentEngine {
  private config: AssignmentEngineConfig;
  private state: AssignmentEngineState;
  private candidateGenerator: CandidateGenerator;
  private scorer: Scorer;
  private optimizer: AdaptiveOptimizer;
  private etaModel: ETAModel;
  private reassignmentEngine: ReassignmentEngine;
  private surgeHandler: SurgeHandler;
  private cycleCount: number = 0;

  constructor(config: AssignmentEngineConfig) {
    this.config = config;

    this.candidateGenerator = new CandidateGenerator(config.candidateGeneration, config.fatigue);
    this.etaModel = new ETAModel(config.eta);
    this.scorer = new Scorer(config.weights, this.etaModel, config.sla.slaRiskSigmoidScale);
    this.optimizer = new AdaptiveOptimizer();
    this.reassignmentEngine = new ReassignmentEngine(config.reassignment);
    this.surgeHandler = new SurgeHandler(config.surge);

    this.state = {
      orders: new Map(),
      riders: new Map(),
      assignments: new Map(),
      cycleHistory: [],
      reassignmentHistory: [],
      lastCycleTimestamp: new Date(),
      surgeState: {
        level: 'normal',
        demandSupplyRatio: 0,
        pendingOrderCount: 0,
        availableCapacity: 0,
        recommendedActions: [],
      },
    };
  }

  public updateState(orders: Map<string, Order>, riders: Map<string, Rider>): void {
    this.state.orders = orders;
    this.state.riders = riders;

    this.candidateGenerator.updateRiderLocations(riders);
  }

  public executeCycle(): AssignmentCycleResult {
    const cycleId = this.generateCycleId();
    const now = new Date();

    const availableRiders = Array.from(this.state.riders.values()).filter(
      r => r.status === 'active' || r.status === 'on_delivery'
    ).length;
    const activeBatchCapacity = Math.max(
      ...Array.from(this.state.riders.values()).map(r => r.vehicle.maxItems)
    );

    const pendingOrderCount = Array.from(this.state.orders.values()).filter(
      o => o.status === 'pending_assignment'
    ).length;

    this.state.surgeState = this.surgeHandler.detectSurge(pendingOrderCount, availableRiders, activeBatchCapacity);

    const unassignedOrders = Array.from(this.state.orders.values()).filter(
      o => o.status === 'pending_assignment'
    );

    if (unassignedOrders.length === 0) {
      return {
        cycleId,
        timestamp: now,
        decisions: [],
        successCount: 0,
        failureCount: 0,
        metrics: {
          avgCost: 0,
          totalSlaSlackMinutes: 0,
          riderUtilization: {},
        },
      };
    }

    const candidates = this.stage1CandidateGeneration(unassignedOrders, now);
    const scores = this.stage2Scoring(unassignedOrders, candidates, now);
    const assignments = this.stage3GlobalOptimization(scores);
    const decisions = this.createAssignmentDecisions(assignments);
    const reassignmentTriggersexecute = this.reassignmentEngine.detectTriggers(
      this.state.orders,
      this.state.riders,
      this.state.assignments,
      now
    );

    for (const trigger of reassignmentTriggersexecute) {
      this.handleReassignmentTrigger(trigger);
    }

    const result: AssignmentCycleResult = {
      cycleId,
      timestamp: now,
      decisions,
      successCount: decisions.length,
      failureCount: unassignedOrders.length - decisions.length,
      metrics: {
        avgCost: this.calculateAverageCost(decisions),
        totalSlaSlackMinutes: this.calculateTotalSlaSlack(decisions),
        riderUtilization: this.calculateRiderUtilization(),
      },
    };

    this.state.cycleHistory.push(result);
    this.cycleCount++;

    return result;
  }

  private stage1CandidateGeneration(
    orders: Order[],
    now: Date
  ): Map<string, string[]> {
    const candidates = new Map<string, string[]>();

    for (const order of orders) {
      const result = this.candidateGenerator.generateCandidates(order, this.state.riders, now);
      candidates.set(result.orderId, result.candidateRiderIds);
    }

    return candidates;
  }

  private stage2Scoring(
    orders: Order[],
    candidates: Map<string, string[]>,
    now: Date
  ): ScoringResult[] {
    const scores: ScoringResult[] = [];

    for (const order of orders) {
      const candidateRiders = candidates.get(order.orderId) || [];

      for (const riderId of candidateRiders) {
        const rider = this.state.riders.get(riderId);
        if (!rider) continue;

        const score = this.scorer.scoreAssignment(order, rider, now);
        scores.push(score);
      }
    }

    return scores;
  }

  /**
   * Stage 3: Global Assignment Optimization
   */
  private stage3GlobalOptimization(scores: ScoringResult[]): Map<string, string> {
    const orderIds = Array.from(new Set(scores.map(s => s.orderId)));
    const riderIds = Array.from(new Set(scores.map(s => s.riderId)));

    const costMatrix: number[][] = Array(orderIds.length)
      .fill(null)
      .map(() => Array(riderIds.length).fill(1e10));

    for (const score of scores) {
      const orderIdx = orderIds.indexOf(score.orderId);
      const riderIdx = riderIds.indexOf(score.riderId);
      costMatrix[orderIdx][riderIdx] = score.cost;
    }

    const matrix: AssignmentMatrix = {
      orders: orderIds,
      riders: riderIds,
      costMatrix,
    };

    const result = this.optimizer.optimize(
      matrix,
      this.config.hungarianThreshold
    );

    return result.assignments;
  }

  private createAssignmentDecisions(assignments: Map<string, string>): AssignmentDecision[] {
    const decisions: AssignmentDecision[] = [];

    for (const [orderId, riderId] of assignments) {
      const order = this.state.orders.get(orderId);
      const rider = this.state.riders.get(riderId);

      if (!order || !rider) continue;

      decisions.push({
        orderId,
        riderId,
        sequenceIndex: rider.currentAssignments.length,
      });

      order.status = 'assigned';
      order.assignedRiderId = riderId;
      order.assignmentAttempts++;

      rider.currentAssignments.push(orderId);
    }

    return decisions;
  }

  private handleReassignmentTrigger(trigger: any): void {
    for (const orderId of trigger.affectedOrderIds) {
      const order = this.state.orders.get(orderId);
      if (!order) continue;
      if (!this.reassignmentEngine.canReassign(orderId)) {
        continue;
      }
      const currentRider = this.state.riders.get(order.assignedRiderId || '');
      if (currentRider && this.reassignmentEngine.isReassignmentSuppressed(currentRider, order.pickup.location)) {
        continue;
      }
      order.status = 'pending_assignment';
      order.assignedRiderId = null;
      this.reassignmentEngine.recordReassignment(orderId);
    }
  }

  private generateCycleId(): string {
    return `cycle_${Date.now()}_${this.cycleCount}`;
  }
  /**
   * Utility: Calculate average cost
   */
  private calculateAverageCost(decisions: AssignmentDecision[]): number {
    if (decisions.length === 0) return 0;
    return 0.5;
  }

  private calculateTotalSlaSlack(decisions: AssignmentDecision[]): number {
    let total = 0;
    for (const decision of decisions) {
      const order = this.state.orders.get(decision.orderId);
      if (order) {
        const slack = (order.slaDeadline.getTime() - Date.now()) / 60000;
        total += slack;
      }
    }
    return total;
  }

  private calculateRiderUtilization(): Record<string, number> {
    const utilization: Record<string, number> = {};

    for (const [riderId, rider] of this.state.riders) {
      const totalCapacity = rider.vehicle.maxItems;
      const currentLoad = rider.load.itemCount;
      utilization[riderId] = currentLoad / totalCapacity;
    }

    return utilization;
  }

  public getState(): AssignmentEngineState {
    return this.state;
  }

  public getMetrics() {
    const lastCycle = this.state.cycleHistory[this.state.cycleHistory.length - 1];
    const reassignmentStats = this.reassignmentEngine.getStats();

    return {
      cycleCount: this.cycleCount,
      lastCycle,
      surgeState: this.state.surgeState,
      reassignmentStats,
      totalAssignments: this.state.assignments.size,
      etaCacheStats: this.etaModel.getCacheStats(),
    };
  }
}
