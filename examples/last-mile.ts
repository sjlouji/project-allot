/**
 * E-Commerce Last-Mile Delivery Example
 *
 * Scenario: OnlineShop last-mile fulfillment
 * - Cost optimization priority (large scale, thin margins)
 * - Longer SLAs (1-2 days)
 * - All vehicle types (bikes, cars, vans)
 * - Larger batches for efficiency
 * - Zone-based optimization
 *
 * Run: npx ts-node examples/last-mile.ts
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
  MARKET_CONFIGS,
} from '../src';





function createLastMileOrders(): Map<string, Order> {
  const orders = new Map<string, Order>();
  const now = new Date();

  const orderData = [

    {
      id: 'EM001',
      pickup: { lat: 12.9716, lng: 77.5946 },
      delivery: { lat: 12.975, lng: 77.601 },
      slaHours: 24,
      weight: 0.5,
      items: 1,
    },
    {
      id: 'EM002',
      pickup: { lat: 12.9716, lng: 77.5946 },
      delivery: { lat: 12.9780, lng: 77.6020 },
      slaHours: 24,
      weight: 1.0,
      items: 2,
    },
    {
      id: 'EM003',
      pickup: { lat: 12.9716, lng: 77.5946 },
      delivery: { lat: 12.9750, lng: 77.5980 },
      slaHours: 24,
      weight: 2.0,
      items: 3,
    },
    {
      id: 'EM004',
      pickup: { lat: 12.9716, lng: 77.5946 },
      delivery: { lat: 12.9820, lng: 77.5950 },
      slaHours: 48,
      weight: 1.5,
      items: 2,
    },
    {
      id: 'EM005',
      pickup: { lat: 12.9716, lng: 77.5946 },
      delivery: { lat: 12.9700, lng: 77.6100 },
      slaHours: 24,
      weight: 0.8,
      items: 1,
    },


    {
      id: 'EM006',
      pickup: { lat: 12.9352, lng: 77.6245 },
      delivery: { lat: 12.9425, lng: 77.6337 },
      slaHours: 48,
      weight: 2.5,
      items: 4,
    },
    {
      id: 'EM007',
      pickup: { lat: 12.9352, lng: 77.6245 },
      delivery: { lat: 12.9250, lng: 77.6100 },
      slaHours: 48,
      weight: 3.0,
      items: 5,
    },
    {
      id: 'EM008',
      pickup: { lat: 12.9352, lng: 77.6245 },
      delivery: { lat: 12.9300, lng: 77.6400 },
      slaHours: 48,
      weight: 1.2,
      items: 2,
    },
    {
      id: 'EM009',
      pickup: { lat: 12.9352, lng: 77.6245 },
      delivery: { lat: 12.9180, lng: 77.6050 },
      slaHours: 48,
      weight: 4.0,
      items: 6,
    },
  ];

  orderData.forEach(data => {
    orders.set(data.id, {
      orderId: data.id,
      status: 'pending_assignment',
      createdAt: now,
      slaDeadline: new Date(now.getTime() + data.slaHours * 60 * 60 * 1000),
      pickup: {
        location: data.pickup as Location,
        address: { street: 'Warehouse Rd', city: 'Bangalore', postalCode: '560001' },
        storeId: 'warehouse',
        estimatedPickupWaitMinutes: 5,
      } as OrderPickup,
      delivery: {
        location: data.delivery as Location,
        address: { street: 'Delivery St', city: 'Bangalore', postalCode: '560001' },
        customerId: 'cust_' + data.id,
        preferredDeliveryWindow: { startMinutes: 0, endMinutes: data.slaHours * 60 },
      } as OrderDelivery,
      payload: {
        weightKg: data.weight,
        volumeLiters: data.weight * 1.5,
        itemCount: data.items,
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





function createLastMileRiders(): Map<string, Rider> {
  const riders = new Map<string, Rider>();
  const now = new Date();

  const riderData = [

    {
      id: 'BIKE_A1',
      location: { lat: 12.972, lng: 77.591 },
      type: 'bike' as const,
      zone: 'downtown',
    },
    {
      id: 'CAR_A1',
      location: { lat: 12.968, lng: 77.607 },
      type: 'car' as const,
      zone: 'downtown',
    },
    {
      id: 'VAN_A1',
      location: { lat: 12.975, lng: 77.595 },
      type: 'van' as const,
      zone: 'downtown',
    },


    {
      id: 'BIKE_B1',
      location: { lat: 12.940, lng: 77.625 },
      type: 'bike' as const,
      zone: 'suburbs',
    },
    {
      id: 'CAR_B1',
      location: { lat: 12.935, lng: 77.620 },
      type: 'car' as const,
      zone: 'suburbs',
    },
    {
      id: 'VAN_B1',
      location: { lat: 12.938, lng: 77.625 },
      type: 'van' as const,
      zone: 'suburbs',
    },
  ];

  riderData.forEach(data => {
    riders.set(data.id, {
      riderId: data.id,
      status: 'active',
      location: data.location as Location,
      vehicle: {
        type: data.type,
        maxWeightKg: {
          bike: 10,
          car: 50,
          van: 200,
        }[data.type]!,
        maxVolumeLiters: {
          bike: 20,
          car: 150,
          van: 500,
        }[data.type]!,
        maxItems: {
          bike: 5,
          car: 20,
          van: 100,
        }[data.type]!,
        capabilities: ['standard'],
      } as Vehicle,
      shift: {
        startTime: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() + 8 * 60 * 60 * 1000),
        continuousDrivingMinutes: 120,
        totalShiftDrivingMinutes: 360,
      } as RiderShift,
      currentAssignments: [],
      currentRoute: [],
      load: {
        weightKg: 5,
        volumeLiters: 10,
        itemCount: 3,
      } as RiderLoad,
      performance: {
        zoneFamiliarityScores: {
          [data.zone]: 0.95,
          other: 0.60,
        },
        avgDeliverySuccessRate: 0.99,
        avgSpeedMultiplier: 1.0,
        totalDeliveries: data.type === 'bike' ? 2000 : data.type === 'car' ? 1500 : 500,
      } as RiderPerformance,
    });
  });

  return riders;
}





function createLastMileConfig() {

  const baseConfig = MARKET_CONFIGS.cost_optimized();


  return new ConfigurationBuilder()
    .setWeights({
      w1_time: 0.20,
      w2_slaRisk: 0.20,
      w3_distance: 0.35,
      w4_batchDisruption: 0.15,
      w5_workload: 0.08,
      w6_affinity: 0.02,
    })

    .setMaxBatchSizes({
      bike: 5,
      car: 12,
      van: 30,
    })

    .setSLARiskScale(15)
    .build();
}





function runLastMileExample() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' E-COMMERCE LAST-MILE DELIVERY EXAMPLE');
  console.log('═══════════════════════════════════════════════════════════\n');


  const config = createLastMileConfig();
  console.log(' Configuration:');
  console.log('  - Distance Weight: 35% (cost optimization)');
  console.log('  - SLA Weight: 20% (24-48h windows)');
  console.log('  - Max Batch: 5 bikes, 12 cars, 30 vans');
  console.log('  - SLA Risk Scale: 15 (gentle penalty)\n');


  const engine = new AssignmentEngine(config);


  const orders = createLastMileOrders();
  const riders = createLastMileRiders();

  console.log(` Orders: ${orders.size}`);
  let zoneACount = 0;
  let zoneBCount = 0;

  orders.forEach((order, id) => {
    if (id.includes('EM00') && parseInt(id.slice(-1]) <= 5) zoneACount++;
    else zoneBCount++;
  });

  console.log(`  - Zone A (Downtown): ${zoneACount} orders`);
  console.log(`  - Zone B (Suburbs): ${zoneBCount} orders`);

  console.log(`\n Riders: ${riders.size}`);
  console.log(`  - Zone A: 3 riders (bike, car, van)`);
  console.log(`  - Zone B: 3 riders (bike, car, van)`);


  engine.updateState(orders, riders);


  console.log('\n  Executing assignment cycle...\n');
  const result = engine.executeCycle();


  console.log(' ASSIGNMENT RESULTS');
  console.log('─────────────────────────────────────────────────────────');
  console.log(` Assigned: ${result.successCount} orders`);
  console.log(` Failed: ${result.failureCount} orders`);
  console.log(` Avg Cost: ${result.metrics.avgCost.toFixed(3)}`);
  console.log(`  Total SLA Slack: ${result.metrics.totalSlaSlackMinutes} minutes\n`);


  if (result.decisions.length > 0) {
    const assignmentsByRider = new Map<string, Array<{ id: string; seq: number }>>();

    result.decisions.forEach(decision => {
      if (!assignmentsByRider.has(decision.riderId)) {
        assignmentsByRider.set(decision.riderId, []);
      }
      assignmentsByRider
        .get(decision.riderId)!
        .push({ id: decision.orderId, seq: decision.sequenceIndex });
    });

    console.log('BATCH ASSIGNMENTS:');
    console.log('─────────────────────────────────────────────────────────');

    const riderIds = Array.from(assignmentsByRider.keys()).sort();
    riderIds.forEach(riderId => {
      const assignments = assignmentsByRider.get(riderId)!;
      const rider = riders.get(riderId);

      console.log(`\n  ${riderId} (${rider?.vehicle.type})`);
      assignments.forEach(({ id, seq }) => {
        console.log(`    [${seq}] ${id}`);
      });

      const totalWeight = assignments.reduce((sum, { id }) => {
        const order = orders.get(id);
        return sum + (order?.payload.weightKg || 0);
      }, 0);

      const totalItems = assignments.reduce((sum, { id }) => {
        const order = orders.get(id);
        return sum + (order?.payload.itemCount || 0);
      }, 0);

      const capacity = rider?.vehicle.maxWeightKg || 1;
      const utilPct = ((totalWeight / capacity) * 100).toFixed(0);

      console.log(`    -> ${assignments.length} orders, ${totalWeight.toFixed(1)}kg (${utilPct}% capacity)`);
    });
  }


  console.log('\n\nRIDER UTILIZATION METRICS:');
  console.log('─────────────────────────────────────────────────────────');

  let totalWeight = 0;
  let totalOrders = 0;
  const assignmentsByRider = new Map<string, number>();

  result.decisions.forEach(decision => {
    const order = orders.get(decision.orderId);
    if (order) {
      totalWeight += order.payload.weightKg;
      totalOrders += order.payload.itemCount;
      assignmentsByRider.set(
        decision.riderId,
        (assignmentsByRider.get(decision.riderId) || 0) + 1
      );
    }
  });

  assignmentsByRider.forEach((count, riderId) => {
    const rider = riders.get(riderId);
    if (rider) {
      const pct = ((count / riders.size) * 100).toFixed(0);
      console.log(`  ${riderId}: ${count} orders (${pct}% share)`);
    }
  });

  console.log(`\n  Total Weight: ${totalWeight.toFixed(1)} kg`);
  console.log(`  Total Items: ${totalOrders}`);


  const state = engine.getState();
  console.log('\nSURGE STATUS:');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`  Level: ${state.surgeState.level}`);
  console.log(`  Demand/Supply Ratio: ${state.surgeState.demandSupplyRatio.toFixed(2)}`);
  console.log(`  Available Capacity: ${state.surgeState.availableCapacity}`);

  console.log('\n═══════════════════════════════════════════════════════════\n');
}





if (require.main === module) {
  runLastMileExample();
}

export { createLastMileOrders, createLastMileRiders, createLastMileConfig };
