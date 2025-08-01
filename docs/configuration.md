# Configuration Guide

Complete reference for customizing the assignment engine.

## Quick Config

```typescript
import { ConfigurationBuilder } from '@project/allot';

const config = new ConfigurationBuilder()
  .setWeights({
    w1_time: 0.30,
    w2_slaRisk: 0.35,
    w3_distance: 0.15,
    w4_batchDisruption: 0.12,
    w5_workload: 0.05,
    w6_affinity: 0.03,
  })
  .setCycleInterval(30)
  .setSLARiskScale(10)
  .setSurgeRatios(1.2, 1.5, 2.0)
  .setMaxBatchSizes({ bike: 3, car: 5, van: 8 })
  .build();

const engine = new AssignmentEngine(config);
```

## All Configuration Options

### Scoring Weights

```typescript
weights: {
  w1_time: 0.30,              // Pickup time delay
  w2_slaRisk: 0.35,           // SLA breach risk
  w3_distance: 0.15,          // Travel distance
  w4_batchDisruption: 0.12,   // Route disruption
  w5_workload: 0.05,          // Workload balance
  w6_affinity: 0.03,          // Zone familiarity
}

//  MUST sum to 1.0 (ConfigurationBuilder validates this)
```

### Cycle Parameters

```typescript
cycleIntervalSeconds: 30,         // Run assignment every N sec
maxOrdersPerCycle: 500,           // Max orders per cycle
maxRidersPerAssignment: 150,      // Max riders to consider
optimizerTimeoutSeconds: 1.5,     // Hungarian algo timeout
hungarianThreshold: 10000,        // Switch to greedy if > N orders
```

### Candidate Generation

```typescript
candidateGeneration: {
  initialRadiusKm: 5,                    // Base search radius
  expandedRadiusKm: 10,                  // First expansion
  maxRadiusKm: 20,                       // Maximum search radius
  radiusExpansionMinutesThreshold: 20,   // Expand if SLA < 20 min
}
```

### Batching

```typescript
batching: {
  maxBatchSize: {
    bike: 3,
    car: 5,
    van: 8,
  },
  maxBatchDurationMinutes: 45,    // Max delivery window
  twoOptIterationLimit: 100,      // Local search iterations
}
```

### Reassignment

```typescript
reassignment: {
  maxReassignmentAttempts: 3,           // Attempts per order
  suppressionRadiusMeters: 500,         // Block re-candidates nearby
  triggerEtaSpikeMinutes: 15,           // Reassign if ETA +15
  triggerHighPrioritySlaCutoffMinutes: 20,  // Critical orders within 20 min
}
```

### Surge Handling

```typescript
surge: {
  softSurgeRatio: 1.2,            // 20% demand spike
  hardSurgeRatio: 1.5,            // 50% demand spike
  crisisRatio: 2.0,               // 100% demand spike
  prepositionLookbackMinutes: 30, // Historical demand window
  batchSizeIncrement: 1,          // +1 per batch in surge
  radiusExpansionFactor: 1.5,     // 1.5x radius in surge
}
```

### ETA Model

```typescript
eta: {
  trafficApiRefreshSeconds: 60,   // Update traffic data
  riderModelRetrainCron: '0 2 * * *',  // Retrain at 2 AM
  serviceTimeDefaults: {
    restaurant_pickup: 5,
    dark_store_pickup: 2,
    apartment_delivery: 4,
    ground_floor_delivery: 2,
    house_delivery: 3,
    commercial_delivery: 2,
  },
  etaCacheMinutes: 5,             // Cache ETA for 5 min
}
```

### Fatigue Management

```typescript
fatigue: {
  maxContinuousDrivingMinutes: 120,  // Mandatory break after
  mandatoryBreakMinutes: 15,         // Break duration
  maxShiftDrivingMinutes: 480,       // Max daily driving (8 hours)
}
```

### SLA Configuration

```typescript
sla: {
  nearBreachThresholdMinutes: 20,        // Alert when within 20 min
  breachEscalationAlertThresholdPct: 2.0,// Alert at 2% breach rate
  slaRiskSigmoidScale: 10,              // Sigmoid curve steepness
}
```

## Use Case Configs

### Food Delivery (Fast, Fresh)

```typescript
MARKET_CONFIGS.high_sla_priority()

// Custom tweaks:
new ConfigurationBuilder()
  .setWeights({
    w1_time: 0.20,          // Less critical
    w2_slaRisk: 0.50,       // Heavily penalize late
    w3_distance: 0.15,      // Prefer close riders
    w4_batchDisruption: 0.10,
    w5_workload: 0.05,
    w6_affinity: 0.00,      // No zone preference
  })
  .setMaxBatchSizes({ bike: 2, car: 4, van: 6 })  // Smaller batches
  .setSLARiskScale(8)  // Steeper SLA penalty
  .build()
```

### E-commerce Last-Mile (Cost Optimized)

```typescript
MARKET_CONFIGS.cost_optimized()

// Or customize:
new ConfigurationBuilder()
  .setWeights({
    w1_time: 0.25,
    w2_slaRisk: 0.20,       // Softer SLA
    w3_distance: 0.30,      // Minimize km
    w4_batchDisruption: 0.15,
    w5_workload: 0.08,      // Balance workload
    w6_affinity: 0.02,
  })
  .setMaxBatchSizes({ bike: 4, car: 6, van: 10 })  // Larger batches
  .build()
```

### Peak Hours (Surge Optimized)

```typescript
MARKET_CONFIGS.surge_optimized()

// Aggressive batch expansion:
new ConfigurationBuilder()
  .setSurgeRatios(1.1, 1.3, 1.8)  // Faster escalation
  .setMaxBatchSizes({ bike: 4, car: 7, van: 12 })
  .build()
```

### Medications/Urgent (SLA Critical)

```typescript
new ConfigurationBuilder()
  .setWeights({
    w1_time: 0.10,
    w2_slaRisk: 0.70,       // Extreme SLA focus
    w3_distance: 0.10,
    w4_batchDisruption: 0.05,
    w5_workload: 0.05,
    w6_affinity: 0.00,
  })
  .setSLARiskScale(5)         // Very steep sigmoid
  .setCycleInterval(10)        // Faster cycles
  .setMaxBatchSizes({ bike: 1, car: 2, van: 3 })  // No batching
  .build()
```

## Strategy Patterns

### Pattern 1: Balanced (Default)

```typescript
MARKET_CONFIGS.bangalore_default()

// Pros: Good for mixed scenarios
// Cons: May not excel in specific conditions
```

**When to use:** General purpose, unknown demand patterns

### Pattern 2: SLA First

```typescript
new ConfigurationBuilder()
  .setWeights({
    w1_time: 0.20,
    w2_slaRisk: 0.60,
    w3_distance: 0.10,
    w4_batchDisruption: 0.05,
    w5_workload: 0.05,
    w6_affinity: 0.00,
  })
  .build()
```

**When to use:** Premium customers, perishables, time-sensitive

### Pattern 3: Cost First

```typescript
new ConfigurationBuilder()
  .setWeights({
    w1_time: 0.20,
    w2_slaRisk: 0.15,
    w3_distance: 0.40,
    w4_batchDisruption: 0.20,
    w5_workload: 0.05,
    w6_affinity: 0.00,
  })
  .setMaxBatchSizes({ bike: 5, car: 8, van: 15 })
  .build()
```

**When to use:** Budget operations, non-urgent orders, B2B

### Pattern 4: Throughput First

```typescript
new ConfigurationBuilder()
  .setWeights({
    w1_time: 0.05,
    w2_slaRisk: 0.10,
    w3_distance: 0.05,
    w4_batchDisruption: 0.30,  // Keep routes together
    w5_workload: 0.40,         // Max utilization
    w6_affinity: 0.10,
  })
  .setMaxBatchSizes({ bike: 6, car: 10, van: 20 })
  .setCycleInterval(60)        // Longer cycles
  .build()
```

**When to use:** High volume, stable demand

## Validation Rules

All configs are validated:

```typescript
const config = new ConfigurationBuilder()
  .setWeights({...})
  .build();  // Throws if weights don't sum to 1.0

// Error: "Scoring weights must sum to 1.0, got 0.950"
```

## Runtime Adjustment

 Configs are immutable after creation. To change:

```typescript
// Create new engine with new config
const newConfig = new ConfigurationBuilder()
  .setWeights({...})
  .build();

const newEngine = new AssignmentEngine(newConfig);
newEngine.updateState(orders, riders);
const result = newEngine.executeCycle();
```

## Performance Tuning

### For Speed

```typescript
new ConfigurationBuilder()
  .setCycleInterval(60)        // Less frequent
  .build()
  // Result: 50% less CPU, 60s delay for new assignments
```

### For Responsiveness

```typescript
new ConfigurationBuilder()
  .setCycleInterval(10)        // Very frequent
  .build()
  // Result: 80% more CPU, 10s delay for new assignments
```

### For Large Scale

```typescript
new ConfigurationBuilder()
  .build()
  // hungarianThreshold = 10000 (switches to greedy for huge batches)
```

## See Also

- [Algorithms Deep Dive](./algorithms.md)
- [Food Delivery Example](./examples/food-delivery.ts)
- [Last-Mile Example](./examples/last-mile.ts)
