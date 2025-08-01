# Algorithms Deep Dive

## Stage 1: Candidate Generation

Filters riders based on **geographic proximity** and **hard constraints**.

### Geographic Filtering

Uses **adaptive radius expansion** based on SLA time remaining:

```
SLA Time Remaining      Radius Used
─────────────────────────────────────
> 20 min                5 km (initial)
10-20 min               10 km (expanded)
< 10 min                20 km (max radius)
```

This ensures urgent orders can still find candidates even in sparse areas.

### Hard Constraints Checked

Each candidate is validated against:

1. **Capacity** - Vehicle can fit payload (weight, volume, items)
2. **Vehicle Type** - Matches order requirements (bike/car/van/refrigerated)
3. **Shift Time** - Enough time to complete before shift end
4. **Fatigue** - Within continuous driving and daily limits
5. **SLA Feasibility** - Can reach on time even with no traffic
6. **Rider Status** - Active or on delivery (not break/offline)

### Example

```typescript
const candidates = candidateGenerator.generateCandidates(order, riders, now);

if (candidates.candidateRiderIds.length === 0) {
  console.log(`No candidates: ${candidates.failureReason}`);
  // Handle: may retry next cycle or escalate
}
```

---

## Stage 2: Multi-Objective Scoring

Ranks candidates using **6 weighted factors**.

### Factor 1: Time Cost (w1_time = 0.30)

```
Cost = clamp(totalMinutes / 120, 0, 1)
```

Measures delay to pickup. Normalized to 120-minute window.

**Example:**
- 30 min pickup delay -> cost = 0.25
- 120 min pickup delay -> cost = 1.00

### Factor 2: SLA Risk Cost (w2_slaRisk = 0.35)

Uses **sigmoid function** to model breach probability:

```
Risk = 1 / (1 + exp(slackMinutes / scale))

where:
  slackMinutes = minutes until SLA deadline
  scale = 10 (configurable sigmoid steepness)
```

**Example (scale=10):**
- 30 min slack -> risk = 0.05 (5% chance)
- 0 min slack (on time) -> risk = 0.50
- -30 min slack (late) -> risk = 0.95

Steeply penalizes assignments that risk SLA breaches.

### Factor 3: Distance Cost (w3_distance = 0.15)

```
Cost = clamp(distanceKm / 20, 0, 1)
```

Normalized to 20 km. Prefers nearby riders.

### Factor 4: Batch Disruption Cost (w4_batchDisruption = 0.12)

Estimates route detour when inserting new order:

```
Detour = (distToPickup + distPickupToNext - directDist)
Cost = clamp(detour / 60, 0, 1)
```

Penalizes breaking good existing routes.

### Factor 5: Workload Cost (w5_workload = 0.05)

Balances utilization:

```
Cost = max(0, (riderLoad - avgLoad) / maxLoad)
```

Prefers underutilized riders to balance team load.

### Factor 6: Affinity Cost (w6_affinity = 0.03)

Rewards zone familiarity:

```
Cost = 1 - zoneFamiliarityScore
```

Gives slight boost to familiar delivery areas.

### Composite Score

```
totalCost = w1*timeCost + w2*slaRisk + w3*distance
          + w4*batchDisruption + w5*workload + w6*affinity
```

Lower score = better assignment.

### Example

```typescript
const score = scorer.scoreAssignment(order, rider, now);

console.log(`Total Cost: ${score.cost.toFixed(3)}`);
console.log(`  Time: ${score.costBreakdown.deltaTimeCost.toFixed(3)}`);
console.log(`  SLA Risk: ${score.costBreakdown.slaRiskCost.toFixed(3)}`);
console.log(`  Distance: ${score.costBreakdown.distanceCost.toFixed(3)}`);
```

---

## Stage 3: Global Optimization

Solves the **assignment problem** using **Hungarian algorithm**.

### Problem Definition

Given:
- N orders to assign
- M riders available
- Cost matrix C[i][j] = cost of assigning order i to rider j

Find: One-to-one assignment that minimizes total cost.

### Hungarian Algorithm

**Time Complexity:** O(n³)
**Space Complexity:** O(n²)

Optimal solution guaranteed (unlike greedy approaches).

### When to Use Different Optimizers

```typescript
// Adaptive (default) - picks best for problem size
const optimizer = new AdaptiveOptimizer();

// For small problems (< 10 orders)
const optimizer = new HungarianOptimizer();

// For large sparse problems
const optimizer = new GreedyOptimizer();

// For auction-based matching
const optimizer = new AuctionOptimizer();
```

### Example

```typescript
const matrix = {
  orders: ['order1', 'order2', 'order3'],
  riders: ['rider1', 'rider2', 'rider3'],
  costMatrix: [
    [0.5, 0.8, 0.9],
    [0.6, 0.4, 0.7],
    [0.7, 0.6, 0.3],
  ],
};

const result = optimizer.optimize(matrix);

for (const [orderId, riderId] of result.assignments) {
  console.log(`${orderId} -> ${riderId}`);
}
console.log(`Total cost: ${result.totalCost.toFixed(3)}`);
```

---

## Batching Algorithm

Once assignments are made, orders can be grouped into delivery batches.

### Cheapest Insertion Heuristic

1. Start with nearest order to rider
2. Iteratively insert remaining orders at position that minimizes route increase
3. Refine with 2-opt local search

### Example

```typescript
const batchRoute = batchOptimizer.optimizeBatch(rider, ordersForRider);

console.log(`Sequence: ${batchRoute.ordersSequence}`);
console.log(`Total distance: ${batchRoute.totalDistance.toFixed(1)} km`);
console.log(`Duration: ${batchRoute.totalDurationMinutes} min`);
```

---

## Surge Detection

Monitors demand-supply ratio and adjusts behavior.

### Surge Levels

```
Ratio        Level           Actions
─────────────────────────────────────────────────────
0.0 - 1.2    normal          Standard assignment
1.2 - 1.5    soft_surge      +1 batch size, +50% search radius
1.5 - 2.0    hard_surge      Preposition riders, hold SLA orders
2.0+         crisis          Emergency protocol, customer notification
```

### Example

```typescript
const demandSupplyRatio = pendingOrders / (availableRiders * batchCapacity);

const surgeState = surgeHandler.detectSurge(
  pendingOrders,
  availableRiders,
  batchCapacity
);

if (surgeState.level === 'hard_surge') {
  console.log('Actions:');
  surgeState.recommendedActions.forEach(action => {
    console.log(`  - ${action}`);
  });
}
```

---

## Reassignment Triggers

Monitors conditions that warrant reassigning orders.

### Trigger Types

| Trigger | Condition | Action |
|---------|-----------|--------|
| **rider_offline** | Rider goes offline/inactive | Reassign all orders |
| **eta_spike** | ETA increases by 15+ min | Reassign affected orders |
| **high_priority_arrival** | Critical order within 20 min | Reassign to make room |
| **new_rider_online** | New rider available | Check if better match |

### Example

```typescript
const triggers = reassignmentEngine.detectTriggers(
  orders, riders, assignments, now
);

triggers.forEach(trigger => {
  console.log(`Trigger: ${trigger.type}`);
  console.log(`Affected orders: ${trigger.affectedOrderIds}`);
  console.log(`Reason: ${trigger.reason}`);
});
```

---

## Performance Tips

### 1. Tune Cycle Interval

```typescript
// Faster response (more CPU)
.setCycleInterval(15)  // 15 sec

// More stable (less overhead)
.setCycleInterval(60)  // 60 sec
```

### 2. Use Market Configs

Pre-tuned for specific scenarios:
```typescript
MARKET_CONFIGS.bangalore_default()       // Balanced
MARKET_CONFIGS.high_sla_priority()       // Premium
MARKET_CONFIGS.surge_optimized()         // Peak hours
MARKET_CONFIGS.cost_optimized()          // Budget
```

### 3. Customize Hungarian Threshold

```typescript
// For problems with > 10000 orders, use greedy approximation
const config = new ConfigurationBuilder()
  .build();
// hungarianThreshold = 10000 by default
```

### 4. Cache ETA Estimates

```typescript
// Default: 5 minute cache
// Reduce for fast-changing traffic:
eta: {
  etaCacheMinutes: 2,
  trafficApiRefreshSeconds: 30,
}
```

---

## See Also

- [Configuration Guide](./configuration.md)
- [Food Delivery Example](./examples/food-delivery.ts)
- [Last-Mile Example](./examples/last-mile.ts)
