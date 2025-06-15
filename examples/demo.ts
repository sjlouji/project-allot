import {
  AssignmentEngine,
  createDefaultConfig,
  Order,
  Rider,
} from '../src';

function createSampleOrders(count: number): Map<string, Order> {
  const orders = new Map<string, Order>();

  for (let i = 0; i < count; i++) {
    const order: Order = {
      orderId: `order_${i}`,
      status: 'pending_assignment',
      createdAt: new Date(),
      slaDeadline: new Date(Date.now() + 60 * 60 * 1000),
      pickup: {
        location: { lat: 12.9716 + Math.random() * 0.1, lng: 77.5946 + Math.random() * 0.1 },
        address: { street: 'Pickup St', city: 'Bangalore', postalCode: '560001' },
        storeId: `store_${i}`,
        estimatedPickupWaitMinutes: 5,
      },
      delivery: {
        location: { lat: 12.9716 + Math.random() * 0.1, lng: 77.5946 + Math.random() * 0.1 },
        address: { street: 'Delivery St', city: 'Bangalore', postalCode: '560001' },
        customerId: `customer_${i}`,
      },
      payload: {
        weightKg: 2,
        volumeLiters: 5,
        itemCount: 1,
        requiresColdChain: false,
        fragile: false,
        vehicleRequirement: 'any',
      },
      priority: 'normal',
      assignmentAttempts: 0,
      assignedRiderId: null,
    };
    orders.set(order.orderId, order);
  }

  return orders;
}

function createSampleRiders(count: number): Map<string, Rider> {
  const riders = new Map<string, Rider>();

  for (let i = 0; i < count; i++) {
    const rider: Rider = {
      riderId: `rider_${i}`,
      status: 'active',
      location: { lat: 12.9716 + Math.random() * 0.1, lng: 77.5946 + Math.random() * 0.1 },
      vehicle: {
        type: i % 3 === 0 ? 'van' : i % 3 === 1 ? 'car' : 'bike',
        maxWeightKg: 20,
        maxVolumeLiters: 50,
        maxItems: 5,
        capabilities: ['standard'],
      },
      shift: {
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
        continuousDrivingMinutes: 30,
        totalShiftDrivingMinutes: 120,
      },
      currentAssignments: [],
      currentRoute: [],
      load: {
        weightKg: 0,
        volumeLiters: 0,
        itemCount: 0,
      },
      performance: {
        zoneFamiliarityScores: {},
        avgDeliverySuccessRate: 0.95,
        avgSpeedMultiplier: 1.0,
        totalDeliveries: 100,
      },
    };
    riders.set(rider.riderId, rider);
  }

  return riders;
}

async function main() {
  console.log('Last Mile Assignment Engine Demo');

  const config = createDefaultConfig();
  const engine = new AssignmentEngine(config);

  const orders = createSampleOrders(10);
  const riders = createSampleRiders(5);

  engine.updateState(orders, riders);
  const result = engine.executeCycle();

  console.log(`Assigned: ${result.successCount}/${orders.size}`);
  console.log(`Failed: ${result.failureCount}`);
  console.log(`Surge Level: ${result.surgeState.level}`);
}

if (require.main === module) {
  main();
}
