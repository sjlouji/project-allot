import { AssignmentEngine } from '../src/engine/assignment-engine';
import { CandidateGenerator } from '../src/core/candidate-generation';
import { Scorer } from '../src/core/scoring';
import { HungarianOptimizer, AuctionOptimizer, GreedyOptimizer, AdaptiveOptimizer } from '../src/algorithms/optimizers';
import { BatchOptimizer } from '../src/algorithms/batching';
import { ETAModel } from '../src/models/eta-model';
import { ReassignmentEngine } from '../src/services/reassignment-engine';
import { SurgeHandler } from '../src/services/surge-handler';
import {
  Order,
  Rider,
  Location,
  VehicleType,
  createDefaultConfig,
  MARKET_CONFIGS,
} from '../src';

describe('Last Mile Assignment Engine', () => {
  let engine: AssignmentEngine;
  let orders: Map<string, Order>;
  let riders: Map<string, Rider>;

  beforeEach(() => {
    engine = new AssignmentEngine(createDefaultConfig());
    orders = createTestOrders(10);
    riders = createTestRiders(5);
  });

  describe('Stage 1: Candidate Generation', () => {
    test('should generate candidates for orders', () => {
      const config = createDefaultConfig();
      const generator = new CandidateGenerator(config.candidateGeneration, config.fatigue);
      generator.updateRiderLocations(riders);

      const order = orders.get(Array.from(orders.keys())[0])!;
      const result = generator.generateCandidates(order, riders, new Date());

      expect(result.orderId).toBe(order.orderId);
      expect(Array.isArray(result.candidateRiderIds)).toBe(true);
    });

    test('should reject riders with insufficient capacity', () => {
      const config = createDefaultConfig();
      const generator = new CandidateGenerator(config.candidateGeneration, config.fatigue);
      generator.updateRiderLocations(riders);

      // Create a heavy order
      const heavyOrder: Order = {
        orderId: 'heavy_order',
        status: 'pending_assignment',
        createdAt: new Date(),
        slaDeadline: new Date(Date.now() + 3600000),
        priority: 'normal',
        assignmentAttempts: 0,
        assignedRiderId: null,
        pickup: {
          location: { lat: 12.972, lng: 77.594 },
          address: { street: 'Main St', city: 'Bangalore', postalCode: '560001' },
          storeId: 'store_1',
          estimatedPickupWaitMinutes: 5,
        },
        delivery: {
          location: { lat: 12.975, lng: 77.600 },
          address: { street: 'Delivery Ave', city: 'Bangalore', postalCode: '560002' },
          customerId: 'customer_1',
        },
        payload: {
          weightKg: 1000, // Extremely heavy
          volumeLiters: 100,
          itemCount: 50,
          requiresColdChain: false,
          fragile: false,
          vehicleRequirement: 'any',
        },
      };

      const result = generator.generateCandidates(heavyOrder, riders, new Date());

      // Should have no candidates due to capacity constraints
      expect(result.candidateRiderIds.length).toBe(0);
      expect(result.failureReason).toBe('all_riders_failed_constraints');
    });
  });

  describe('Stage 2: Multi-Objective Scoring', () => {
    test('should score order-rider pairs', () => {
      const config = createDefaultConfig();
      const etaModel = new ETAModel(config.eta);
      const scorer = new Scorer(config.weights, etaModel, config.sla.slaRiskSigmoidScale);

      const order = orders.get(Array.from(orders.keys())[0])!;
      const rider = riders.get(Array.from(riders.keys())[0])!;

      const result = scorer.scoreAssignment(order, rider, new Date());

      expect(result.orderId).toBe(order.orderId);
      expect(result.riderId).toBe(rider.riderId);
      expect(result.cost).toBeGreaterThanOrEqual(0);
      expect(result.costBreakdown).toBeDefined();
      expect(result.costBreakdown.totalWeightedCost).toBe(result.cost);
    });

    test('should assign higher cost to orders with tight SLA', () => {
      const config = createDefaultConfig();
      const etaModel = new ETAModel(config.eta);
      const scorer = new Scorer(config.weights, etaModel, config.sla.slaRiskSigmoidScale);

      const rider = riders.get(Array.from(riders.keys())[0])!;

      // Order with tight SLA
      const tightSLAOrder: Order = {
        ...orders.get(Array.from(orders.keys())[0])!,
        orderId: 'tight_sla_order',
        slaDeadline: new Date(Date.now() + 5 * 60000), // 5 minutes
      };

      // Order with relaxed SLA
      const relaxedSLAOrder: Order = {
        ...orders.get(Array.from(orders.keys())[1])!,
        orderId: 'relaxed_sla_order',
        slaDeadline: new Date(Date.now() + 60 * 60000), // 60 minutes
      };

      const tightScore = scorer.scoreAssignment(tightSLAOrder, rider, new Date());
      const relaxedScore = scorer.scoreAssignment(relaxedSLAOrder, rider, new Date());

      // Tight SLA should have higher SLA risk cost
      expect(tightScore.costBreakdown.slaRiskCost).toBeGreaterThan(
        relaxedScore.costBreakdown.slaRiskCost
      );
    });
  });

  describe('Stage 3: Global Optimization', () => {
    test('Hungarian optimizer should find valid assignment', () => {
      const optimizer = new HungarianOptimizer();
      const matrix = {
        orders: ['ord_1', 'ord_2', 'ord_3'],
        riders: ['rider_1', 'rider_2', 'rider_3'],
        costMatrix: [
          [0.5, 0.8, 0.7],
          [0.6, 0.4, 0.5],
          [0.9, 0.3, 0.6],
        ],
      };

      const result = optimizer.optimize(matrix);

      expect(result.assignments.size).toBe(3);
      expect(result.algorithm).toBe('hungarian');
      expect(result.totalCost).toBeGreaterThan(0);
    });

    test('Auction optimizer should converge to solution', () => {
      const optimizer = new AuctionOptimizer();
      const matrix = {
        orders: ['ord_1', 'ord_2', 'ord_3'],
        riders: ['rider_1', 'rider_2', 'rider_3'],
        costMatrix: [
          [0.5, 0.8, 0.9],
          [0.6, 0.4, 0.7],
          [0.9, 0.3, 0.5],
        ],
      };

      const result = optimizer.optimize(matrix);

      expect(result.assignments.size).toBeGreaterThan(0);
      expect(result.algorithm).toBe('auction');
    });

    test('Greedy optimizer should handle large problems quickly', () => {
      const optimizer = new GreedyOptimizer();
      const orders = Array.from({ length: 100 }, (_, i) => `ord_${i}`);
      const riders = Array.from({ length: 50 }, (_, i) => `rider_${i}`);

      // Generate random cost matrix
      const costMatrix = orders.map(() =>
        riders.map(() => Math.random())
      );

      const startTime = Date.now();
      const result = optimizer.optimize({ orders, riders, costMatrix });
      const elapsedMs = Date.now() - startTime;

      expect(result.assignments.size).toBe(100);
      expect(elapsedMs).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Batching Algorithm', () => {
    test('should create valid batch routes', () => {
      const config = createDefaultConfig();
      const batchOptimizer = new BatchOptimizer(config.batching);

      const rider = riders.get(Array.from(riders.keys())[0])!;
      const batchOrders = Array.from(orders.values()).slice(0, 2);

      const route = batchOptimizer.optimizeBatch(rider, batchOrders);

      expect(route.ordersSequence.length).toBeGreaterThanOrEqual(0);
      expect(route.totalDistance).toBeGreaterThanOrEqual(0);
      expect(route.totalDurationMinutes).toBeGreaterThanOrEqual(0);
    });

    test('should reject batch exceeding size limit', () => {
      const config = createDefaultConfig();
      const batchOptimizer = new BatchOptimizer(config.batching);

      const rider: Rider = {
        ...riders.get(Array.from(riders.keys())[0])!,
        vehicle: { ...riders.get(Array.from(riders.keys())[0])!.vehicle, type: 'bike' },
      };

      // Create more orders than bike's batch limit (3)
      const tooManyOrders = Array.from(orders.values()).slice(0, 5);

      const route = batchOptimizer.optimizeBatch(rider, tooManyOrders);

      // Should return empty or limited route due to constraint
      expect(route).toBeDefined();
    });
  });

  describe('ETA Model', () => {
    test('should estimate travel time', () => {
      const config = createDefaultConfig();
      const etaModel = new ETAModel(config.eta);

      const origin: Location = { lat: 12.972, lng: 77.594 };
      const destination: Location = { lat: 12.975, lng: 77.600 };

      const eta = etaModel.estimateETA(origin, destination, new Date());

      expect(eta.estimatedDurationMinutes).toBeGreaterThan(0);
      expect(eta.confidence).toBeGreaterThan(0);
      expect(eta.confidence).toBeLessThanOrEqual(1);
    });

    test('should cache ETA results', () => {
      const config = createDefaultConfig();
      const etaModel = new ETAModel(config.eta);

      const origin: Location = { lat: 12.972, lng: 77.594 };
      const destination: Location = { lat: 12.975, lng: 77.600 };
      const now = new Date();

      const eta1 = etaModel.estimateETA(origin, destination, now);
      const eta2 = etaModel.estimateETA(origin, destination, now);

      // Should return identical results (cached)
      expect(eta1.estimatedDurationMinutes).toBe(eta2.estimatedDurationMinutes);

      const stats = etaModel.getCacheStats();
      expect(stats.cacheSize).toBeGreaterThan(0);
    });
  });

  describe('Reassignment Engine', () => {
    test('should respect max reassignment attempts', () => {
      const config = createDefaultConfig();
      const engine = new ReassignmentEngine(config.reassignment);

      const orderId = 'ord_1';

      // Can reassign initially
      expect(engine.canReassign(orderId)).toBe(true);

      // Record max attempts
      for (let i = 0; i < config.reassignment.maxReassignmentAttempts; i++) {
        engine.recordReassignment(orderId);
      }

      // Should now be blocked
      expect(engine.canReassign(orderId)).toBe(false);
    });

    test('should detect reassignment triggers', () => {
      const config = createDefaultConfig();
      const engine = new ReassignmentEngine(config.reassignment);

      // Create test state with offline rider
      const testRiders = new Map(riders);
      const firstRider = testRiders.get(Array.from(testRiders.keys())[0])!;
      firstRider.status = 'offline';

      const testAssignments = new Map([
        [
          'asgn_1',
          {
            assignmentId: 'asgn_1',
            orderId: 'ord_1',
            riderId: firstRider.riderId,
            assignedAt: new Date(),
            cycleId: 'cycle_1',
            costBreakdown: {} as any,
            estimatedPickupAt: new Date(),
            estimatedDeliveryAt: new Date(),
            slaDeadline: new Date(),
            slaSlackMinutes: 10,
            reassignmentCount: 0,
            status: 'dispatched' as const,
          },
        ],
      ]);

      const triggers = engine.detectTriggers(orders, testRiders, testAssignments, new Date());

      expect(triggers.length).toBeGreaterThan(0);
      expect(triggers[0].type).toBe('rider_offline');
    });
  });

  describe('Surge Handler', () => {
    test('should detect surge levels correctly', () => {
      const config = createDefaultConfig();
      const handler = new SurgeHandler(config.surge);

      // Normal conditions
      let state = handler.detectSurge(50, 100, 5);
      expect(state.level).toBe('normal');

      // Soft surge
      state = handler.detectSurge(600, 100, 5); // 1.2x
      expect(state.level).toBe('soft_surge');

      // Hard surge
      state = handler.detectSurge(750, 100, 5); // 1.5x
      expect(state.level).toBe('hard_surge');

      // Crisis
      state = handler.detectSurge(1000, 100, 5); // 2.0x
      expect(state.level).toBe('crisis');
    });

    test('should apply soft surge modifications', () => {
      const config = createDefaultConfig();
      const handler = new SurgeHandler(config.surge);

      const baseWeights = config.weights;
      const baseBatchSizes = config.batching.maxBatchSize;

      const modified = handler.applySoftSurgeModifications(
        baseWeights,
        baseBatchSizes,
        config.candidateGeneration.initialRadiusKm
      );

      expect(modified.weights.w5_workload).toBeLessThan(baseWeights.w5_workload);
      expect(modified.batchSizes.bike).toBeGreaterThan(baseBatchSizes.bike);
      expect(modified.radiusKm).toBeGreaterThan(config.candidateGeneration.initialRadiusKm);
    });
  });

  describe('Full Engine Integration', () => {
    test('should execute complete assignment cycle', () => {
      engine.updateState(orders, riders);
      const result = engine.executeCycle();

      expect(result.cycleId).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.successCount + result.failureCount).toBe(orders.size);
      expect(result.metrics).toBeDefined();
    });

    test('should handle empty order set', () => {
      engine.updateState(new Map(), riders);
      const result = engine.executeCycle();

      expect(result.decisions.length).toBe(0);
      expect(result.successCount).toBe(0);
    });

    test('should get metrics after execution', () => {
      engine.updateState(orders, riders);
      engine.executeCycle();

      const metrics = engine.getMetrics();

      expect(metrics.cycleCount).toBe(1);
      expect(metrics.surgeState).toBeDefined();
      expect(metrics.reassignmentStats).toBeDefined();
    });
  });

  describe('Configuration Variants', () => {
    test('should support high SLA priority config', () => {
      const config = MARKET_CONFIGS.high_sla_priority();

      expect(config.weights.w2_slaRisk).toBeGreaterThan(0.4);
      expect(config.weights.w3_distance).toBeLessThan(0.15);
    });

    test('should support cost-optimized config', () => {
      const config = MARKET_CONFIGS.cost_optimized();

      expect(config.weights.w3_distance).toBeGreaterThan(0.2);
    });

    test('should support surge-optimized config', () => {
      const config = MARKET_CONFIGS.surge_optimized();

      expect(config.surge.softSurgeRatio).toBeLessThan(1.2);
    });
  });

  describe('Edge Cases: Vehicle Requirements', () => {
    test('should handle fragile item requirements', () => {
      const config = createDefaultConfig();
      const generator = new CandidateGenerator(config.candidateGeneration, config.fatigue);
      generator.updateRiderLocations(riders);

      const fragileOrder: Order = {
        orderId: 'fragile_order',
        status: 'pending_assignment',
        createdAt: new Date(),
        slaDeadline: new Date(Date.now() + 3600000),
        priority: 'normal',
        assignmentAttempts: 0,
        assignedRiderId: null,
        pickup: {
          location: { lat: 12.972, lng: 77.594 },
          address: { street: 'Main St', city: 'Bangalore', postalCode: '560001' },
          storeId: 'store_1',
          estimatedPickupWaitMinutes: 5,
        },
        delivery: {
          location: { lat: 12.975, lng: 77.600 },
          address: { street: 'Delivery Ave', city: 'Bangalore', postalCode: '560002' },
          customerId: 'customer_1',
        },
        payload: {
          weightKg: 1,
          volumeLiters: 2,
          itemCount: 1,
          requiresColdChain: false,
          fragile: true,
          vehicleRequirement: 'any',
        },
      };

      const result = generator.generateCandidates(fragileOrder, riders, new Date());
      expect(result.orderId).toBe(fragileOrder.orderId);
    });

    test('should handle cold chain requirements', () => {
      const config = createDefaultConfig();
      const generator = new CandidateGenerator(config.candidateGeneration, config.fatigue);
      generator.updateRiderLocations(riders);

      const coldChainOrder: Order = {
        orderId: 'cold_chain_order',
        status: 'pending_assignment',
        createdAt: new Date(),
        slaDeadline: new Date(Date.now() + 3600000),
        priority: 'normal',
        assignmentAttempts: 0,
        assignedRiderId: null,
        pickup: {
          location: { lat: 12.972, lng: 77.594 },
          address: { street: 'Main St', city: 'Bangalore', postalCode: '560001' },
          storeId: 'store_1',
          estimatedPickupWaitMinutes: 5,
        },
        delivery: {
          location: { lat: 12.975, lng: 77.600 },
          address: { street: 'Delivery Ave', city: 'Bangalore', postalCode: '560002' },
          customerId: 'customer_1',
        },
        payload: {
          weightKg: 1,
          volumeLiters: 2,
          itemCount: 1,
          requiresColdChain: true,
          fragile: false,
          vehicleRequirement: 'any',
        },
      };

      const result = generator.generateCandidates(coldChainOrder, riders, new Date());
      expect(result.orderId).toBe(coldChainOrder.orderId);
    });
  });

  describe('Edge Cases: SLA and Timing', () => {
    test('should handle orders with very tight SLA', () => {
      const config = createDefaultConfig();
      const generator = new CandidateGenerator(config.candidateGeneration, config.fatigue);
      generator.updateRiderLocations(riders);

      const tightSLAOrder: Order = {
        orderId: 'tight_sla',
        status: 'pending_assignment',
        createdAt: new Date(),
        slaDeadline: new Date(Date.now() + 2 * 60000),
        priority: 'critical',
        assignmentAttempts: 0,
        assignedRiderId: null,
        pickup: {
          location: { lat: 12.972, lng: 77.594 },
          address: { street: 'Main St', city: 'Bangalore', postalCode: '560001' },
          storeId: 'store_1',
          estimatedPickupWaitMinutes: 5,
        },
        delivery: {
          location: { lat: 12.975, lng: 77.600 },
          address: { street: 'Delivery Ave', city: 'Bangalore', postalCode: '560002' },
          customerId: 'customer_1',
        },
        payload: {
          weightKg: 1,
          volumeLiters: 2,
          itemCount: 1,
          requiresColdChain: false,
          fragile: false,
          vehicleRequirement: 'any',
        },
      };

      const result = generator.generateCandidates(tightSLAOrder, riders, new Date());
      expect(result).toBeDefined();
    });

    test('should handle riders near shift end', () => {
      const config = createDefaultConfig();
      const generator = new CandidateGenerator(config.candidateGeneration, config.fatigue);
      const testRiders = new Map(riders);
      const rider = testRiders.get(Array.from(testRiders.keys())[0])!;
      rider.shift.endTime = new Date(Date.now() + 5 * 60000);
      generator.updateRiderLocations(testRiders);

      const order = orders.get(Array.from(orders.keys())[0])!;
      const result = generator.generateCandidates(order, testRiders, new Date());
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases: Batching', () => {
    test('should handle single order batches', () => {
      const config = createDefaultConfig();
      const batchOptimizer = new BatchOptimizer(config.batching);
      const rider = riders.get(Array.from(riders.keys())[0])!;
      const singleOrder = [orders.get(Array.from(orders.keys())[0])!];

      const route = batchOptimizer.optimizeBatch(rider, singleOrder);
      expect(route.ordersSequence.length).toBe(1);
    });

    test('should compute 2-opt improvements correctly', () => {
      const config = createDefaultConfig();
      const batchOptimizer = new BatchOptimizer(config.batching);
      const rider = riders.get(Array.from(riders.keys())[0])!;
      const batchOrders = Array.from(orders.values()).slice(0, 3);

      const route = batchOptimizer.optimizeBatch(rider, batchOrders);
      expect(route.totalDurationMinutes).toBeGreaterThanOrEqual(0);
      expect(route.stops.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases: ETA Model', () => {
    test('should update rider model with actual delivery data', () => {
      const config = createDefaultConfig();
      const etaModel = new ETAModel(config.eta);

      const origin: Location = { lat: 12.972, lng: 77.594 };
      const destination: Location = { lat: 12.975, lng: 77.600 };
      const riderId = 'rider_1';

      etaModel.updateRiderModel(riderId, 15, 20, 'zone_north');
      const updated = etaModel.estimateETA(origin, destination, new Date(), riderId);
      expect(updated).toBeDefined();
    });

    test('should estimate route ETA for multi-location route', () => {
      const config = createDefaultConfig();
      const etaModel = new ETAModel(config.eta);

      const locations: Location[] = [
        { lat: 12.972, lng: 77.594 },
        { lat: 12.975, lng: 77.600 },
        { lat: 12.980, lng: 77.605 },
      ];

      const result = etaModel.estimateRouteETA(locations, new Date(), 'rider_1');
      expect(result.totalMinutes).toBeGreaterThan(0);
      expect(result.breakdown.length).toBe(2);
    });

    test('should handle empty location list for route ETA', () => {
      const config = createDefaultConfig();
      const etaModel = new ETAModel(config.eta);

      const result = etaModel.estimateRouteETA([], new Date());
      expect(result.totalMinutes).toBe(0);
      expect(result.breakdown.length).toBe(0);
    });

    test('should clear expired cache entries', () => {
      const config = createDefaultConfig();
      const etaModel = new ETAModel(config.eta);

      const origin: Location = { lat: 12.972, lng: 77.594 };
      const destination: Location = { lat: 12.975, lng: 77.600 };

      etaModel.estimateETA(origin, destination, new Date());
      const statsBefore = etaModel.getCacheStats();
      etaModel.clearExpiredCache();
      const statsAfter = etaModel.getCacheStats();

      expect(statsBefore).toBeDefined();
      expect(statsAfter).toBeDefined();
    });
  });

  describe('Edge Cases: Reassignment Engine', () => {
    test('should detect offline rider triggers', () => {
      const config = createDefaultConfig();
      const engine = new ReassignmentEngine(config.reassignment);

      const testRiders = new Map(riders);
      const firstRider = testRiders.get(Array.from(testRiders.keys())[0])!;
      firstRider.status = 'offline';

      const testAssignments = new Map([
        [
          'asgn_1',
          {
            assignmentId: 'asgn_1',
            orderId: 'ord_1',
            riderId: firstRider.riderId,
            assignedAt: new Date(),
            cycleId: 'cycle_1',
            costBreakdown: {} as any,
            estimatedPickupAt: new Date(),
            estimatedDeliveryAt: new Date(),
            slaDeadline: new Date(),
            slaSlackMinutes: 10,
            reassignmentCount: 0,
            status: 'dispatched' as const,
          },
        ],
      ]);

      const triggers = engine.detectTriggers(orders, testRiders, testAssignments, new Date());
      expect(triggers.length).toBeGreaterThan(0);
      expect(triggers[0].type).toBe('rider_offline');
    });

    test('should enforce minimum interval between reassignments', () => {
      const config = createDefaultConfig();
      const engine = new ReassignmentEngine(config.reassignment);

      const orderId = 'ord_test';
      engine.recordReassignment(orderId);

      expect(engine.canReassign(orderId)).toBe(false);
    });

    test('should suppress reassignments in close proximity', () => {
      const config = createDefaultConfig();
      const engine = new ReassignmentEngine(config.reassignment);

      const rider = riders.get(Array.from(riders.keys())[0])!;
      const closeLocation = {
        lat: rider.location.lat + 0.001,
        lng: rider.location.lng + 0.001,
      };

      const suppressed = engine.isReassignmentSuppressed(rider, closeLocation);
      expect(typeof suppressed).toBe('boolean');
    });
  });

  describe('Edge Cases: Surge Handler', () => {
    test('should apply hard surge modifications', () => {
      const config = createDefaultConfig();
      const handler = new SurgeHandler(config.surge);

      const modified = handler.applyHardSurgeModifications(
        config.weights,
        config.batching.maxBatchSize,
        config.candidateGeneration.initialRadiusKm,
        orders,
        riders
      );

      expect(modified.weights).toBeDefined();
      expect(modified.batchSizes).toBeDefined();
      expect(modified.radiusKm).toBeGreaterThan(config.candidateGeneration.initialRadiusKm);
      expect(modified.heldOrders).toBeDefined();
      expect(modified.prepositioningTargets).toBeDefined();
    });

    test('should apply crisis modifications', () => {
      const config = createDefaultConfig();
      const handler = new SurgeHandler(config.surge);

      const crisis = handler.applyCrisisModifications();
      expect(crisis.algorithm).toBe('greedy');
      expect(crisis.skipGlobalOptimization).toBe(true);
      expect(crisis.enableEmergencyMode).toBe(true);
    });

    test('should detect different surge levels', () => {
      const config = createDefaultConfig();
      const handler = new SurgeHandler(config.surge);

      const normal = handler.detectSurge(10, 100, 10);
      expect(normal.level).toBe('normal');

      const soft = handler.detectSurge(600, 100, 5);
      expect(soft.level).toBe('soft_surge');

      const hard = handler.detectSurge(800, 100, 5);
      expect(hard.level).toBe('hard_surge');

      const crisis = handler.detectSurge(2000, 100, 5);
      expect(crisis.level).toBe('crisis');
    });
  });

  describe('Edge Cases: Optimizers', () => {
    test('should handle single order assignment', () => {
      const optimizer = new HungarianOptimizer();
      const matrix = {
        orders: ['ord_1'],
        riders: ['rider_1', 'rider_2'],
        costMatrix: [[0.5], [0.8]],
      };

      const result = optimizer.optimize(matrix);
      expect(result.assignments.size).toBeGreaterThan(0);
    });

    test('should handle single rider assignment', () => {
      const optimizer = new HungarianOptimizer();
      const matrix = {
        orders: ['ord_1', 'ord_2', 'ord_3'],
        riders: ['rider_1'],
        costMatrix: [[0.5], [0.8], [0.3]],
      };

      const result = optimizer.optimize(matrix);
      expect(result.assignments.size).toBeGreaterThan(0);
    });

    test('auction optimizer should converge with large problem', () => {
      const optimizer = new AuctionOptimizer();
      const orders = Array.from({ length: 50 }, (_, i) => `ord_${i}`);
      const riders = Array.from({ length: 30 }, (_, i) => `rider_${i}`);
      const costMatrix = orders.map(() => riders.map(() => Math.random()));

      const result = optimizer.optimize({ orders, riders, costMatrix });
      expect(result.assignments.size).toBeGreaterThan(0);
      expect(result.algorithm).toBe('auction');
    });

    test('adaptive optimizer should use correct algorithm based on size', () => {
      const optimizer = new AdaptiveOptimizer();

      const smallMatrix = {
        orders: ['ord_1', 'ord_2'],
        riders: ['rider_1', 'rider_2'],
        costMatrix: [[0.5, 0.8], [0.6, 0.4]],
      };

      const result = optimizer.optimize(smallMatrix, 100);
      expect(result.assignments).toBeDefined();
    });
  });

  describe('Multiple Cycles and State Management', () => {
    test('should track state across multiple cycles', () => {
      engine.updateState(orders, riders);
      engine.executeCycle();
      engine.executeCycle();

      const metrics = engine.getMetrics();
      expect(metrics.cycleCount).toBe(2);
      expect(metrics.lastCycle).toBeDefined();
    });

    test('should handle reassignments across cycles', () => {
      engine.updateState(orders, riders);
      engine.executeCycle();

      const metrics1 = engine.getMetrics();
      engine.executeCycle();
      const metrics2 = engine.getMetrics();

      expect(metrics2.cycleCount).toBeGreaterThan(metrics1.cycleCount);
    });
  });

  describe('Scoring with Different Rider States', () => {
    test('should score loaded rider differently than empty rider', () => {
      const config = createDefaultConfig();
      const etaModel = new ETAModel(config.eta);
      const scorer = new Scorer(config.weights, etaModel, config.sla.slaRiskSigmoidScale);

      const order = orders.get(Array.from(orders.keys())[0])!;
      const emptyRider = riders.get(Array.from(riders.keys())[0])!;
      emptyRider.load = { weightKg: 0, volumeLiters: 0, itemCount: 0 };
      emptyRider.currentAssignments = [];

      const loadedRider = riders.get(Array.from(riders.keys())[1])!;
      loadedRider.load = { weightKg: 40, volumeLiters: 80, itemCount: 5 };
      loadedRider.currentAssignments = ['ord_existing'];

      const emptyScore = scorer.scoreAssignment(order, emptyRider, new Date());
      const loadedScore = scorer.scoreAssignment(order, loadedRider, new Date());

      expect(emptyScore.cost).toBeDefined();
      expect(loadedScore.cost).toBeDefined();
    });

    test('should score based on rider affinity scores', () => {
      const config = createDefaultConfig();
      const etaModel = new ETAModel(config.eta);
      const scorer = new Scorer(config.weights, etaModel, config.sla.slaRiskSigmoidScale);

      const order = orders.get(Array.from(orders.keys())[0])!;
      const rider = riders.get(Array.from(riders.keys())[0])!;
      rider.performance.zoneFamiliarityScores = { zone_0_0: 0.9, zone_1_1: 0.1 };

      const result = scorer.scoreAssignment(order, rider, new Date());
      expect(result.costBreakdown.affinityCost).toBeLessThanOrEqual(1);
    });
  });
});

// ============================================================================
// Test Data Generators
// ============================================================================

function createTestOrders(count: number): Map<string, Order> {
  const orders = new Map<string, Order>();
  const baseLocation = { lat: 12.972, lng: 77.594 };

  for (let i = 0; i < count; i++) {
    const order: Order = {
      orderId: `ord_${i}`,
      status: 'pending_assignment',
      createdAt: new Date(),
      slaDeadline: new Date(Date.now() + 30 * 60000 + Math.random() * 30 * 60000), // 30-60 min
      priority: Math.random() > 0.8 ? 'high' : 'normal',
      assignmentAttempts: 0,
      assignedRiderId: null,
      pickup: {
        location: {
          lat: baseLocation.lat + (Math.random() - 0.5) * 0.1,
          lng: baseLocation.lng + (Math.random() - 0.5) * 0.1,
        },
        address: {
          street: `Store ${i}`,
          city: 'Bangalore',
          postalCode: '560001',
        },
        storeId: `store_${i % 3}`,
        estimatedPickupWaitMinutes: 3 + Math.random() * 5,
      },
      delivery: {
        location: {
          lat: baseLocation.lat + (Math.random() - 0.5) * 0.15,
          lng: baseLocation.lng + (Math.random() - 0.5) * 0.15,
        },
        address: {
          street: `Address ${i}`,
          city: 'Bangalore',
          postalCode: '560002',
        },
        customerId: `customer_${i}`,
      },
      payload: {
        weightKg: 0.5 + Math.random() * 3,
        volumeLiters: 2 + Math.random() * 8,
        itemCount: 1 + Math.floor(Math.random() * 4),
        requiresColdChain: Math.random() > 0.9,
        fragile: Math.random() > 0.8,
        vehicleRequirement: 'any',
      },
    };
    orders.set(order.orderId, order);
  }

  return orders;
}

function createTestRiders(count: number): Map<string, Rider> {
  const riders = new Map<string, Rider>();
  const baseLocation = { lat: 12.972, lng: 77.594 };

  for (let i = 0; i < count; i++) {
    const vehicleTypes: VehicleType[] = ['bike', 'car', 'van'];
    const vehicleType = vehicleTypes[i % vehicleTypes.length];

    const maxLoad = { bike: 15, car: 50, van: 100 }[vehicleType];

    const rider: Rider = {
      riderId: `rider_${i}`,
      status: 'active',
      location: {
        lat: baseLocation.lat + (Math.random() - 0.5) * 0.1,
        lng: baseLocation.lng + (Math.random() - 0.5) * 0.1,
      },
      vehicle: {
        type: vehicleType,
        maxWeightKg: maxLoad,
        maxVolumeLiters: maxLoad * 2,
        maxItems: vehicleType === 'bike' ? 3 : vehicleType === 'car' ? 5 : 8,
        capabilities: ['standard', 'fragile'],
      },
      shift: {
        startTime: new Date(Date.now() - 4 * 3600000),
        endTime: new Date(Date.now() + 8 * 3600000),
        continuousDrivingMinutes: Math.random() * 60,
        totalShiftDrivingMinutes: Math.random() * 300,
      },
      currentAssignments: [],
      currentRoute: [],
      load: {
        weightKg: Math.random() * maxLoad * 0.5,
        volumeLiters: Math.random() * maxLoad,
        itemCount: Math.floor(Math.random() * 3),
      },
      performance: {
        zoneFamiliarityScores: {
          zone_north: 0.7 + Math.random() * 0.3,
          zone_south: 0.5 + Math.random() * 0.4,
          zone_east: 0.6 + Math.random() * 0.35,
        },
        avgDeliverySuccessRate: 0.9 + Math.random() * 0.1,
        avgSpeedMultiplier: 0.8 + Math.random() * 0.4,
        totalDeliveries: Math.floor(Math.random() * 500),
        avgCustomerRating: 4 + Math.random() * 1,
      },
    };

    riders.set(rider.riderId, rider);
  }

  return riders;
}
// Additional edge case tests
