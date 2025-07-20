/**
 * Food Delivery Example
 *
 * Scenario: FreshFood delivery service
 * - Fast delivery requirement (30-45 min SLAs)
 * - High priority on SLA compliance
 * - Bike and car riders only (no vans)
 * - Smaller batches to preserve food freshness
 *
 * Run: npx ts-node examples/food-delivery.ts
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

function createFoodOrders(): Map<string, Order> {
  const orders = new Map<string, Order>();
  const now = new Date();

  const orderData = [
    {
      id: 'FD001',
      pickup: { lat: 12.9716, lng: 77.5946 },
      delivery: { lat: 12.975, lng: 77.601 },
      slaMinutes: 30,
    },
    {
      id: 'FD002',
      pickup: { lat: 12.9716, lng: 77.5946 },
      delivery: { lat: 12.982, lng: 77.595 },
      slaMinutes: 35,
    },
    {
      id: 'FD003',
      pickup: { lat: 12.9352, lng: 77.6245 },
      delivery: { lat: 12.9425, lng: 77.6337 },
      slaMinutes: 30,
    },
    {
      id: 'FD004',
      pickup: { lat: 12.9352, lng: 77.6245 },
      delivery: { lat: 12.9250, lng: 77.6100 },
      slaMinutes: 40,
    },
    {
      id: 'FD005',
      pickup: { lat: 12.9716, lng: 77.5946 },
      delivery: { lat: 12.9800, lng: 77.6050 },
      slaMinutes: 35,
    },
  ];

  orderData.forEach(data => {
    orders.set(data.id, {
      orderId: data.id,
      status: 'pending_assignment',
      createdAt: now,
      slaDeadline: new Date(now.getTime() + data.slaMinutes * 60 * 1000),
      pickup: {
        location: data.pickup as Location,
        address: { street: 'Main St', city: 'Bangalore', postalCode: '560001' },
        storeId: 'rest_' + data.id,
        estimatedPickupWaitMinutes: 3,
      } as OrderPickup,
      delivery: {
        location: data.delivery as Location,
        address: { street: 'Side St', city: 'Bangalore', postalCode: '560001' },
        customerId: 'cust_' + data.id,
        preferredDeliveryWindow: { startMinutes: 0, endMinutes: 90 },
      } as OrderDelivery,
      payload: {
        weightKg: 1.5,
        volumeLiters: 2,
        itemCount: 1,
        requiresColdChain: false,
        fragile: false,
        vehicleRequirement: 'any',
      },
      priority: 'normal',
      assignmentAttempts: 0,
      assignedRiderId: null,
    });
  });

  return orders;
}

function createFoodRiders(): Map<string, Rider> {
  const riders = new Map<string, Rider>();
  const now = new Date();

  const riderData = [
    {
      id: 'BIKE001',
      location: { lat: 12.972, lng: 77.591 },
      vehicleType: 'bike' as const,
    },
    {
      id: 'BIKE002',
      location: { lat: 12.940, lng: 77.625 },
      vehicleType: 'bike' as const,
    },
    {
      id: 'CAR001',
      location: { lat: 12.968, lng: 77.607 },
      vehicleType: 'car' as const,
    },
    {
      id: 'CAR002',
      location: { lat: 12.950, lng: 77.615 },
      vehicleType: 'car' as const,
    },
  ];

  riderData.forEach(data => {
    riders.set(data.id, {
      riderId: data.id,
      status: 'active',
      location: data.location as Location,
      vehicle: {
        type: data.vehicleType,
        maxWeightKg: data.vehicleType === 'bike' ? 5 : 15,
        maxVolumeLiters: data.vehicleType === 'bike' ? 8 : 30,
        maxItems: data.vehicleType === 'bike' ? 3 : 8,
        capabilities: ['standard', 'fragile'],
      } as Vehicle,
      shift: {
        startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() + 6 * 60 * 60 * 1000),
        continuousDrivingMinutes: 45,
        totalShiftDrivingMinutes: 240,
      } as RiderShift,
      currentAssignments: [],
      currentRoute: [],
      load: {
        weightKg: 2,
        volumeLiters: 4,
        itemCount: 2,
      } as RiderLoad,
      performance: {
        zoneFamiliarityScores: { bangalore: 0.85 },
        avgDeliverySuccessRate: 0.98,
        avgSpeedMultiplier: 1.1,
        totalDeliveries: 1250,
      } as RiderPerformance,
    });
  });

  return riders;
}

function createFoodDeliveryConfig() {
  return new ConfigurationBuilder()
    .setWeights({
      w1_time: 0.25,
      w2_slaRisk: 0.50,
      w3_distance: 0.12,
      w4_batchDisruption: 0.08,
      w5_workload: 0.03,
      w6_affinity: 0.02,
    })
    .setMaxBatchSizes({
      bike: 2,
      car: 3,
      van: 0,
    })
    .setSLARiskScale(8)
    .build();
}

function runFoodDeliveryExample() {
  console.log('=================================================================');
  console.log('FOOD DELIVERY ASSIGNMENT ENGINE EXAMPLE');
  console.log('=================================================================\n');

  const config = createFoodDeliveryConfig();
  console.log('Configuration:');
  console.log('  - SLA Risk Weight: 50% (high priority)');
  console.log('  - Max Batch: 2 bikes, 3 cars');
  console.log('  - SLA Risk Scale: 8 (steep penalty)\n');

  const engine = new AssignmentEngine(config);

  const orders = createFoodOrders();
  const riders = createFoodRiders();

  console.log(`Orders: ${orders.size}`);
  orders.forEach(order => {
    const slaMin = Math.round((order.slaDeadline.getTime() - Date.now()) / 60000);
    console.log(`  - ${order.orderId}: SLA in ${slaMin} min`);
  });

  console.log(`\nRiders: ${riders.size}`);
  riders.forEach(rider => {
    console.log(`  - ${rider.riderId}: ${rider.vehicle.type}, at (${rider.location.lat.toFixed(3)}, ${rider.location.lng.toFixed(3)})`);
  });

  engine.updateState(orders, riders);

  console.log('\nExecuting assignment cycle...\n');
  const result = engine.executeCycle();

  console.log('ASSIGNMENT RESULTS');
  console.log('-----------------------------------------------------------------');
  console.log(`Assigned: ${result.successCount} orders`);
  console.log(`Failed: ${result.failureCount} orders`);
  console.log(`Avg Cost: ${result.metrics.avgCost.toFixed(3)}`);
  console.log(`Total SLA Slack: ${result.metrics.totalSlaSlackMinutes} minutes\n`);

  if (result.decisions.length > 0) {
    console.log('ASSIGNMENTS:');
    console.log('-----------------------------------------------------------------');

    const assignmentsByRider = new Map<string, string[]>();

    result.decisions.forEach(decision => {
      const order = orders.get(decision.orderId);
      const rider = riders.get(decision.riderId);

      if (order && rider) {
        console.log(
          `  ${decision.orderId} -> ${decision.riderId}` +
          ` (Seq: ${decision.sequenceIndex})`
        );

        if (!assignmentsByRider.has(decision.riderId)) {
          assignmentsByRider.set(decision.riderId, []);
        }
        assignmentsByRider.get(decision.riderId)!.push(decision.orderId);
      }
    });

    console.log('\nRIDER UTILIZATION:');
    console.log('-----------------------------------------------------------------');
    assignmentsByRider.forEach((orders, riderId) => {
      const utilPct = (orders.length / 3) * 100;
      console.log(`  ${riderId}: ${orders.length} orders (${utilPct.toFixed(0)}% capacity)`);
    });
  }

  const state = engine.getState();
  console.log('\nSURGE STATUS:');
  console.log('-----------------------------------------------------------------');
  console.log(`  Level: ${state.surgeState.level}`);
  console.log(`  Demand/Supply Ratio: ${state.surgeState.demandSupplyRatio.toFixed(2)}`);
  console.log(`  Pending Orders: ${state.surgeState.pendingOrderCount}`);

  if (state.surgeState.recommendedActions.length > 0) {
    console.log(`  Recommended Actions:`);
    state.surgeState.recommendedActions.forEach(action => {
      console.log(`    - ${action}`);
    });
  }

  console.log('\n=================================================================\n');
}

if (require.main === module) {
  runFoodDeliveryExample();
}

export { createFoodOrders, createFoodRiders, createFoodDeliveryConfig };
