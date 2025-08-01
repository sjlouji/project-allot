# Getting Started

Complete step-by-step guide to using the assignment engine.

## 5-Minute Quickstart

### 1. Install

```typescript
import { AssignmentEngine, MARKET_CONFIGS } from '@project/allot';
```

### 2. Create Configuration

```typescript
const config = MARKET_CONFIGS.bangalore_default();
// or create custom:
const config = new ConfigurationBuilder()
  .setWeights({
    w1_time: 0.30,
    w2_slaRisk: 0.35,
    w3_distance: 0.15,
    w4_batchDisruption: 0.12,
    w5_workload: 0.05,
    w6_affinity: 0.03,
  })
  .build();
```

### 3. Create Engine

```typescript
const engine = new AssignmentEngine(config);
```

### 4. Update State

```typescript
engine.updateState(ordersMap, ridersMap);
```

### 5. Assign Orders

```typescript
const result = engine.executeCycle();
console.log(`Assigned: ${result.successCount} orders`);
```

Done! 

---

## Understanding Data Structures

### Order

Represents a delivery request.

```typescript
interface Order {
  orderId: string;
  status: 'pending_assignment' | 'assigned' | 'picked_up' | 'delivered' | 'cancelled';
  createdAt: Date;
  slaDeadline: Date;  // When must delivery be complete

  pickup: OrderPickup;     // Where to pick up
  delivery: OrderDelivery; // Where to deliver
  payload: OrderPayload;   // What is being delivered

  priority: 'normal' | 'high' | 'critical';
  assignmentAttempts: number;
  assignedRiderId: string | null;
}
```

**Creating an Order:**

```typescript
const order: Order = {
  orderId: 'ORD001',
  status: 'pending_assignment',
  createdAt: new Date(),
  slaDeadline: new Date(Date.now() + 45 * 60 * 1000),  // 45 min

  pickup: {
    location: { lat: 12.9716, lng: 77.5946 },
    address: {
      street: 'Main St',
      city: 'Bangalore',
      postalCode: '560001',
      buildingType: 'commercial',
    },
    storeId: 'store_001',
    estimatedPickupWaitMinutes: 5,
    availability: { open: '10:00', close: '22:00' },
  },

  delivery: {
    location: { lat: 12.975, lng: 77.601 },
    address: {
      street: 'Home St',
      city: 'Bangalore',
      postalCode: '560001',
      buildingType: 'apartment',
    },
    customerId: 'cust_001',
    preferredDeliveryWindow: { startMinutes: 0, endMinutes: 60 },
  },

  payload: {
    weightKg: 1.5,
    volumeLiters: 2,
    itemCount: 3,
    requiresColdChain: false,
    fragile: false,
    vehicleRequirement: 'any',  // 'any' | 'bike' | 'car' | 'van' | 'refrigerated'
  },

  priority: 'normal',
  assignmentAttempts: 0,
  assignedRiderId: null,
};
```

### Rider

Represents a delivery agent.

```typescript
interface Rider {
  riderId: string;
  status: 'active' | 'on_delivery' | 'break' | 'offline';
  location: Location;

  vehicle: Vehicle;           // What they drive
  shift: RiderShift;          // When they work
  load: RiderLoad;            // What they're carrying
  performance: RiderPerformance; // How good they are

  currentAssignments: string[];  // Order IDs assigned
  currentRoute: RouteStop[];     // Planned route
}
```

**Creating a Rider:**

```typescript
const rider: Rider = {
  riderId: 'RID001',
  status: 'active',
  location: { lat: 12.972, lng: 77.591 },

  vehicle: {
    type: 'car',  // 'bike' | 'car' | 'van'
    maxWeightKg: 25,
    maxVolumeLiters: 60,
    maxItems: 12,
    capabilities: ['standard', 'fragile'],
  },

  shift: {
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
    continuousDrivingMinutes: 90,      // Driven so far
    totalShiftDrivingMinutes: 360,     // Driven today
  },

  load: {
    weightKg: 5,     // Currently carrying
    volumeLiters: 10,
    itemCount: 3,
  },

  performance: {
    zoneFamiliarityScores: { 'bangalore': 0.85 },
    avgDeliverySuccessRate: 0.98,
    avgSpeedMultiplier: 1.1,   // 10% faster
    totalDeliveries: 1250,
  },

  currentAssignments: ['ORD001', 'ORD002'],
  currentRoute: [
    {
      type: 'pickup',
      orderId: 'ORD001',
      location: { lat: 12.9716, lng: 77.5946 },
      sequenceIndex: 0,
      estimatedArrivalTime: new Date(),
    },
    {
      type: 'delivery',
      orderId: 'ORD001',
      location: { lat: 12.975, lng: 77.601 },
      sequenceIndex: 1,
    },
  ],
};
```

### Assignment Result

Output of executeCycle().

```typescript
interface AssignmentCycleResult {
  cycleId: string;
  timestamp: Date;
  decisions: AssignmentDecision[];  // [{ orderId, riderId, sequenceIndex }, ...]
  successCount: number;              // Orders assigned
  failureCount: number;              // Orders not assigned
  metrics: {
    avgCost: number;                 // Average cost per assignment (0-1)
    totalSlaSlackMinutes: number;    // Total minutes until SLA breach
    riderUtilization: Record<string, number>; // Load per rider
  };
}
```

**Interpreting Results:**

```typescript
const result = engine.executeCycle();

// Check success
if (result.successCount === result.decisions.length) {
  console.log(' All orders assigned');
} else {
  console.log(`  ${result.failureCount} orders unassigned`);
}

// Check efficiency
const efficiencyScore = 1 - result.metrics.avgCost;  // 0-1 scale
console.log(`Efficiency: ${(efficiencyScore * 100).toFixed(0)}%`);

// Check SLA safety
const safetyMinutes = result.metrics.totalSlaSlackMinutes / result.decisions.length;
if (safetyMinutes < 10) {
  console.log('  Low SLA slack - risky');
} else {
  console.log(' Safe SLA margin');
}

// Check utilization
Object.entries(result.metrics.riderUtilization).forEach(([riderId, util]) => {
  console.log(`${riderId}: ${(util * 100).toFixed(0)}% used`);
});
```

---

## Common Patterns

### Pattern 1: One-Off Assignment

```typescript
import { AssignmentEngine, MARKET_CONFIGS } from '@project/allot';

// Use pre-built config
const engine = new AssignmentEngine(MARKET_CONFIGS.bangalore_default());

// Load current state
engine.updateState(ordersMap, ridersMap);

// Assign
const result = engine.executeCycle();

// Process results
result.decisions.forEach(({ orderId, riderId }) => {
  console.log(`${orderId} -> ${riderId}`);
});
```

### Pattern 2: Continuous Optimization

```typescript
// Run in a loop
setInterval(() => {
  engine.updateState(currentOrders, currentRiders);
  const result = engine.executeCycle();

  // Apply assignments
  applyAssignments(result.decisions);

  // Monitor
  logMetrics(result.metrics);
}, 30000);  // Every 30 seconds
```

### Pattern 3: Demand-Responsive Config

```typescript
function selectConfig(demandLevel: 'normal' | 'surge') {
  if (demandLevel === 'surge') {
    // Aggressive settings
    return new ConfigurationBuilder()
      .setWeights({ ... })
      .setSurgeRatios(1.1, 1.3, 1.8)
      .build();
  } else {
    // Balanced
    return MARKET_CONFIGS.bangalore_default();
  }
}

let engine = new AssignmentEngine(selectConfig('normal'));

// Later, if surge detected...
engine = new AssignmentEngine(selectConfig('surge'));
```

### Pattern 4: Multi-Market Operation

```typescript
// Create engines for different regions
const bangalore = new AssignmentEngine(MARKET_CONFIGS.bangalore_default());
const delhi = new AssignmentEngine(MARKET_CONFIGS.high_sla_priority());
const mumbai = new AssignmentEngine(MARKET_CONFIGS.cost_optimized());

// Route to appropriate engine
function assignOrders(market: string, orders: Map, riders: Map) {
  const engine = { bangalore, delhi, mumbai }[market];
  engine.updateState(orders, riders);
  return engine.executeCycle();
}
```

---

## Debugging

### Print Assignment Details

```typescript
const result = engine.executeCycle();

// Show each assignment
result.decisions.forEach(decision => {
  const order = ordersMap.get(decision.orderId);
  const rider = ridersMap.get(decision.riderId);

  console.log(`
    Order: ${decision.orderId}
    Rider: ${decision.riderId}
    Sequence: ${decision.sequenceIndex}
    Cost: ${order.cost.toFixed(3)}
    Breakdown:
      - Time: ${order.costBreakdown.deltaTimeCost.toFixed(3)}
      - SLA: ${order.costBreakdown.slaRiskCost.toFixed(3)}
      - Distance: ${order.costBreakdown.distanceCost.toFixed(3)}
  `);
});
```

### Check Surge State

```typescript
const state = engine.getState();

console.log(`
  Level: ${state.surgeState.level}
  Demand/Supply Ratio: ${state.surgeState.demandSupplyRatio.toFixed(2)}
  Pending Orders: ${state.surgeState.pendingOrderCount}
  Available Capacity: ${state.surgeState.availableCapacity}
  Actions: ${state.surgeState.recommendedActions.join(', ')}
`);
```

### Validate Input

```typescript
// Check order is valid
function validateOrder(order: Order): boolean {
  return (
    order.orderId &&
    order.slaDeadline > order.createdAt &&
    order.payload.weightKg > 0 &&
    order.pickup.location &&
    order.delivery.location
  );
}

// Check rider is valid
function validateRider(rider: Rider): boolean {
  return (
    rider.riderId &&
    rider.status !== 'offline' &&
    rider.location &&
    rider.shift.endTime > new Date()
  );
}
```

---

## Performance Tips

### 1. Batch Updates

```typescript
//  Don't update every order individually
for (const order of orders) {
  engine.updateState(new Map([[order.id, order]]), riders);
}

//  Do batch updates
const orderMap = new Map(orders.map(o => [o.id, o]));
engine.updateState(orderMap, riders);
```

### 2. Cycle Frequency

```typescript
// For responsiveness (more CPU):
.setCycleInterval(15)  // Every 15 seconds

// For stability (less CPU):
.setCycleInterval(60)  // Every 60 seconds
```

### 3. Cache Results

```typescript
// Don't re-run if nothing changed
const lastResult = engine.executeCycle();
const newOrders = fetchNewOrders();

if (newOrders.length > 0) {
  engine.updateState(ordersMap, ridersMap);
  const newResult = engine.executeCycle();
}
```

---

## Next Steps

Once you understand the basics:

1. **Run examples:** `npx ts-node examples/food-delivery.ts`
2. **Read algorithms:** [Deep dive on scoring](./algorithms.md)
3. **Customize config:** [Configuration reference](./configuration.md)
4. **Check tests:** Look at [tests](../tests/) for more patterns

---

## FAQ

**Q: How many orders can the engine handle?**
A: Scales to 1000+ orders per cycle. For larger, it auto-switches to greedy approximation.

**Q: How often should I run cycles?**
A: Every 15-60 seconds depending on business needs. More frequent = more responsive but higher CPU.

**Q: Can I run multiple engines?**
A: Yes! One per market/region/service type is common.

**Q: What if no riders match an order?**
A: It fails gracefully and returns a failureReason. Retry next cycle.

**Q: Can I override assignments?**
A: Recommendations are suggestions. You can apply custom logic.

---

## See Also

- [Examples](../examples/README.md) - Real-world scenarios
- [Algorithms](./algorithms.md) - How scoring works
- [Configuration](./configuration.md) - All config options
- [Tests](../tests/) - More usage patterns
