# Last-Mile Delivery Assignment Engine

A production-ready TypeScript engine for optimally assigning delivery orders to riders using multi-stage optimization, intelligent batching, and dynamic surge handling.

## Quick Start

```typescript
import {
  AssignmentEngine,
  ConfigurationBuilder,
  MARKET_CONFIGS,
} from '@project/allot';

// Create engine with market-specific config
const config = MARKET_CONFIGS.bangalore_default();
const engine = new AssignmentEngine(config);

// Update with current orders and riders
engine.updateState(ordersMap, ridersMap);

// Execute assignment cycle
const result = engine.executeCycle();
console.log(`Assigned ${result.successCount} orders`);
```

## Core Concepts

### 1. Three-Stage Assignment Pipeline

```
┌──────────────────────────────────────┐
│ Stage 1: Candidate Generation        │
│ Filter riders by geography & constraints
└──────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────┐
│ Stage 2: Multi-Objective Scoring     │
│ Rank candidates using 6 weighted factors
└──────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────┐
│ Stage 3: Global Optimization         │
│ Solve assignment problem (Hungarian algo)
└──────────────────────────────────────┘
```

### 2. Scoring Factors (Weights Sum to 1.0)

| Factor | Default Weight | Purpose |
|--------|---|---------|
| **w1_time** | 0.30 | Minimize pickup time delay |
| **w2_slaRisk** | 0.35 | Minimize SLA breach probability |
| **w3_distance** | 0.15 | Minimize travel distance |
| **w4_batchDisruption** | 0.12 | Minimize route disruption |
| **w5_workload** | 0.05 | Balance rider utilization |
| **w6_affinity** | 0.03 | Prefer familiar zones |

### 3. Market Configurations

Pre-built configs for different business priorities:

```typescript
// High SLA compliance (use for premium orders)
const config = MARKET_CONFIGS.high_sla_priority();

// Surge handling (peak hours)
const config = MARKET_CONFIGS.surge_optimized();

// Cost efficiency (budget-conscious)
const config = MARKET_CONFIGS.cost_optimized();

// Default balanced
const config = MARKET_CONFIGS.bangalore_default();
```

## Configuration

### Adjust Scoring Weights

```typescript
const config = new ConfigurationBuilder()
  .setWeights({
    w1_time: 0.25,
    w2_slaRisk: 0.50,  // Prioritize SLA
    w3_distance: 0.10,
    w4_batchDisruption: 0.10,
    w5_workload: 0.05,
    w6_affinity: 0.00,
  })
  .build();
```

### Customize Batching

```typescript
const config = new ConfigurationBuilder()
  .setMaxBatchSizes({
    bike: 3,    // Small packages on bikes
    car: 5,     // Medium loads on cars
    van: 8,     // Large orders on vans
  })
  .build();
```

### Tune SLA Risk Detection

```typescript
const config = new ConfigurationBuilder()
  .setSLARiskScale(10)  // Sigmoid scale (higher = steeper)
  .build();
```

### Configure Surge Behavior

```typescript
const config = new ConfigurationBuilder()
  .setSurgeRatios(
    1.2,    // Soft surge ratio (20% demand spike)
    1.5,    // Hard surge ratio (50% demand spike)
    2.0     // Crisis ratio (100% demand spike)
  )
  .build();
```

## API Reference

### AssignmentEngine

Main orchestrator for the assignment pipeline.

#### Methods

**`constructor(config: AssignmentEngineConfig)`**
- Initialize engine with configuration

**`updateState(orders: Map<string, Order>, riders: Map<string, Rider>): void`**
- Update current orders and riders

**`executeCycle(): AssignmentCycleResult`**
- Run one assignment cycle
- Returns: assignments, metrics, success/failure counts

**`getState(): AssignmentEngineState`**
- Inspect current engine state

### SurgeHandler

Detects demand-supply imbalances.

```typescript
const surgeState = engine.getState().surgeState;

if (surgeState.level === 'hard_surge') {
  // Activate emergency measures
  // - Expand search radius
  // - Increase batch sizes
  // - Hold SLA windows
}
```

### ReassignmentEngine

Triggers reassignments when conditions change.

```typescript
const triggers = reassignmentEngine.detectTriggers(
  orders, riders, assignments, now
);

// Trigger types: rider_offline, eta_spike, high_priority_arrival
```

### ETAModel

Estimates delivery times with traffic and rider performance.

```typescript
const estimate = etaModel.estimateETA(
  pickup.location,
  delivery.location,
  departureTime,
  riderId  // Optional: apply rider speed multiplier
);

console.log(`ETA: ${estimate.estimatedDurationMinutes} min`);
console.log(`Confidence: ${(estimate.confidence * 100).toFixed(0)}%`);
```

## See Also

- [Food Delivery Example](./examples/food-delivery.ts)
- [Last-Mile Example](./examples/last-mile.ts)
- [Surge Handling Example](./examples/surge-handling.ts)
- [Configuration Guide](./configuration.md)
- [Algorithms Deep Dive](./algorithms.md)
