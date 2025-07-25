/**
 * Surge Handling Example
 *
 * Scenario: Managing peak hour demand spikes
 * - Real-time surge detection
 * - Dynamic config adjustments
 * - Batch size expansion
 * - Radius expansion
 * - Recommended actions
 *
 * Run: npx ts-node examples/surge-handling.ts
 */

import {
  Order,
  Rider,
  Location,
  OrderPickup,
  OrderDelivery,
  Vehicle,
  RiderShift,
  RiderLoad,
  RiderPerformance,
  ConfigurationBuilder,
  AssignmentEngine,
} from '../src';





interface ScenarioConfig {
  name: string;
  orders: number;
  riders: number;
  expectedSurgeLevel: string;
}

const SCENARIOS: ScenarioConfig[] = [
  { name: 'Normal', orders: 50, riders: 20, expectedSurgeLevel: 'normal' },
  { name: 'Soft Surge', orders: 75, riders: 20, expectedSurgeLevel: 'soft_surge' },
  { name: 'Hard Surge', orders: 100, riders: 20, expectedSurgeLevel: 'hard_surge' },
  { name: 'Crisis', orders: 150, riders: 20, expectedSurgeLevel: 'crisis' },
];





function createDynamicOrders(count: number): Map<string, Order> {
  const orders = new Map<string, Order>();
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const lat = 12.9716 + (Math.random() - 0.5) * 0.1;
    const lng = 77.5946 + (Math.random() - 0.5) * 0.1;
    const delivLat = 12.9716 + (Math.random() - 0.5) * 0.1;
    const delivLng = 77.5946 + (Math.random() - 0.5) * 0.1;

    orders.set(`ORD${String(i + 1).padStart(4, '0')}`, {
      orderId: `ORD${String(i + 1).padStart(4, '0')}`,
      status: 'pending_assignment',
      createdAt: now,
      slaDeadline: new Date(now.getTime() + (25 + Math.random() * 20) * 60 * 1000),
      pickup: {
        location: { lat, lng } as Location,
        address: { street: 'Market St', city: 'Bangalore', postalCode: '560001' },
        storeId: `store_${i % 3}`,
        estimatedPickupWaitMinutes: 3 + Math.random() * 5,
      } as OrderPickup,
      delivery: {
        location: { lat: delivLat, lng: delivLng } as Location,
        address: { street: 'Home St', city: 'Bangalore', postalCode: '560001' },
        customerId: `cust_${i}`,
        preferredDeliveryWindow: { startMinutes: 0, endMinutes: 60 },
      } as OrderDelivery,
      payload: {
        weightKg: 0.5 + Math.random() * 2,
        volumeLiters: 1 + Math.random() * 4,
        itemCount: 1 + Math.floor(Math.random() * 3),
        requiresColdChain: false,
        fragile: Math.random() < 0.1,
        vehicleRequirement: 'any',
      },
      priority: 'normal',
      assignmentAttempts: 0,
      assignedRiderId: null,
    });
  }

  return orders;
}





function createDynamicRiders(count: number): Map<string, Rider> {
  const riders = new Map<string, Rider>();
  const now = new Date();

  const types: Array<'bike' | 'car' | 'van'> = ['bike', 'car', 'van'];

  for (let i = 0; i < count; i++) {
    const type = types[i % 3];
    const lat = 12.9716 + (Math.random() - 0.5) * 0.15;
    const lng = 77.5946 + (Math.random() - 0.5) * 0.15;

    riders.set(`RID${String(i + 1).padStart(3, '0')}`, {
      riderId: `RID${String(i + 1).padStart(3, '0')}`,
      status: 'active',
      location: { lat, lng } as Location,
      vehicle: {
        type,
        maxWeightKg: type === 'bike' ? 8 : type === 'car' ? 25 : 100,
        maxVolumeLiters: type === 'bike' ? 15 : type === 'car' ? 60 : 300,
        maxItems: type === 'bike' ? 4 : type === 'car' ? 12 : 50,
        capabilities: ['standard'],
      } as Vehicle,
      shift: {
        startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() + 8 * 60 * 60 * 1000),
        continuousDrivingMinutes: 90,
        totalShiftDrivingMinutes: 400,
      } as RiderShift,
      currentAssignments: [],
      currentRoute: [],
      load: {
        weightKg: 1,
        volumeLiters: 2,
        itemCount: 1,
      } as RiderLoad,
      performance: {
        zoneFamiliarityScores: { bangalore: 0.8 },
        avgDeliverySuccessRate: 0.95,
        avgSpeedMultiplier: 1.0,
        totalDeliveries: 500 + Math.random() * 1000,
      } as RiderPerformance,
    });
  }

  return riders;
}





function createSurgeOptimizedConfig() {
  return new ConfigurationBuilder()
    .setWeights({
      w1_time: 0.30,
      w2_slaRisk: 0.35,
      w3_distance: 0.15,
      w4_batchDisruption: 0.16,
      w5_workload: 0.02,
      w6_affinity: 0.02,
    })

    .setSurgeRatios(1.1, 1.3, 1.8)
    .build();
}





function printSurgeReport(
  scenarioName: string,
  orders: number,
  riders: number,
  surgeState: any
) {
  const ratio = (orders / riders).toFixed(2);
  const demandRatio = surgeState.demandSupplyRatio.toFixed(2);

  console.log(`\n SCENARIO: ${scenarioName}`);
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Orders: ${orders}, Riders: ${riders}`);
  console.log(`Orders/Rider Ratio: ${ratio}`);
  console.log(`Demand/Supply Ratio: ${demandRatio}`);
  console.log(`Surge Level: ${surgeState.level.toUpperCase()}`);

  if (surgeState.recommendedActions.length > 0) {
    console.log(`\n RECOMMENDED ACTIONS:`);
    surgeState.recommendedActions.forEach((action: string) => {
      const emoji =
        action.includes('sla') ? '' :
        action.includes('batch') ? '' :
        action.includes('radius') ? '' :
        action.includes('position') ? '' :
        action.includes('escalate') ? '' :
        '->';
      console.log(`  ${emoji} ${action}`);
    });
  }


  const thresholds = {
    soft: 1.2,
    hard: 1.5,
    crisis: 2.0,
  };

  console.log(`\n THRESHOLD INFO:`);
  console.log(`  Soft Surge Threshold: ${thresholds.soft} (${(thresholds.soft * riders).toFixed(0)} orders)`);
  console.log(`  Hard Surge Threshold: ${thresholds.hard} (${(thresholds.hard * riders).toFixed(0)} orders)`);
  console.log(`  Crisis Threshold: ${thresholds.crisis} (${(thresholds.crisis * riders).toFixed(0)} orders)`);
}





function runSurgeHandlingExample() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' SURGE HANDLING DYNAMICS');
  console.log('═══════════════════════════════════════════════════════════');

  const config = createSurgeOptimizedConfig();

  console.log('\n  Configuration:');
  console.log('  - Weights: Balanced with disruption tolerance');
  console.log('  - Surge Ratios: 1.1 (soft), 1.3 (hard), 1.8 (crisis)');
  console.log('  - Batch expansion enabled');
  console.log('  - Radius expansion enabled\n');


  SCENARIOS.forEach(scenario => {
    const engine = new AssignmentEngine(config);
    const orders = createDynamicOrders(scenario.orders);
    const riders = createDynamicRiders(scenario.riders);

    engine.updateState(orders, riders);
    const result = engine.executeCycle();
    const state = engine.getState();

    printSurgeReport(
      scenario.name,
      scenario.orders,
      scenario.riders,
      state.surgeState
    );

    console.log(`\n RESULTS:`);
    console.log(`  Assigned: ${result.successCount}/${scenario.orders}`);
    console.log(`  Success Rate: ${((result.successCount / scenario.orders) * 100).toFixed(1)}%`);
    console.log(`  Avg Cost: ${result.metrics.avgCost.toFixed(3)}`);
  });





  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log(' SURGE ESCALATION PROGRESSION');
  console.log('═══════════════════════════════════════════════════════════\n');

  const riders = createDynamicRiders(20);
  const engine = new AssignmentEngine(config);


  const escalationPoints = [30, 50, 75, 100, 125, 150];

  escalationPoints.forEach(orderCount => {
    const orders = createDynamicOrders(orderCount);
    engine.updateState(orders, riders);
    engine.executeCycle();
    const state = engine.getState();
    const ratio = (orderCount / 20).toFixed(2);

    const statusEmoji =
      state.surgeState.level === 'normal' ? '' :
      state.surgeState.level === 'soft_surge' ? '' :
      state.surgeState.level === 'hard_surge' ? '' :
      '';

    console.log(`${statusEmoji} ${orderCount} orders (${ratio}x) -> ${state.surgeState.level}`);
  });

  console.log('\n═══════════════════════════════════════════════════════════\n');
}





function advancedSurgeResponse() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' CUSTOM SURGE RESPONSE EXAMPLE');
  console.log('═══════════════════════════════════════════════════════════\n');

  const engine = new AssignmentEngine(createSurgeOptimizedConfig());

  const orders = createDynamicOrders(120);
  const riders = createDynamicRiders(20);

  engine.updateState(orders, riders);
  engine.executeCycle();
  const state = engine.getState();

  console.log(`Current Surge Level: ${state.surgeState.level}\n`);


  switch (state.surgeState.level) {
    case 'normal':
      console.log(' Normal operations');
      console.log('  - Standard assignment');
      console.log('  - Normal SLA windows');
      break;

    case 'soft_surge':
      console.log('  Soft Surge Activated');
      console.log('  -> Increase batch size by 1');
      console.log('  -> Expand search radius by 50%');
      console.log('  -> Reduce affinity weight');
      console.log('  -> Monitor incoming orders');
      break;

    case 'hard_surge':
      console.log(' Hard Surge Activated');
      console.log('  -> Double batch sizes');
      console.log('  -> Expand search radius by 100%');
      console.log('  -> Hold SLA window orders temporarily');
      console.log('  -> Call standby riders');
      console.log('  -> Increase driver incentives');
      break;

    case 'crisis':
      console.log(' CRISIS MODE Activated');
      console.log('  -> Emergency protocols');
      console.log('  -> Notify customers (delays expected)');
      console.log('  -> Activate all available resources');
      console.log('  -> Request partner delivery services');
      console.log('  -> Escalate to operations team');
      break;
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}





if (require.main === module) {
  runSurgeHandlingExample();
  advancedSurgeResponse();
}

export {
  createDynamicOrders,
  createDynamicRiders,
  createSurgeOptimizedConfig,
  SCENARIOS,
};
