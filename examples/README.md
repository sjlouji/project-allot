# Examples

Executable examples demonstrating the assignment engine in real-world scenarios.

## Running Examples

All examples are TypeScript files that can be executed with ts-node:

```bash
npx ts-node examples/food-delivery.ts
npx ts-node examples/last-mile.ts
npx ts-node examples/surge-handling.ts
```

## Example 1: Food Delivery

**File**: `examples/food-delivery.ts`

**Scenario**: FreshFood delivery service with strict time constraints

**Key Features**:
- 5 orders with 30-45 minute SLAs
- 4 riders (2 bikes, 2 cars)
- High SLA weight (50%) to prioritize on-time delivery
- Small batch sizes (2 bikes, 3 cars) to preserve food freshness

**Configuration**:
```typescript
const config = new ConfigurationBuilder()
  .setWeights({
    w1_time: 0.25,
    w2_slaRisk: 0.50,       // Heavily penalize late deliveries
    w3_distance: 0.12,
    w4_batchDisruption: 0.08,
    w5_workload: 0.03,
    w6_affinity: 0.02,
  })
  .setMaxBatchSizes({ bike: 2, car: 3, van: 0 })
  .setSLARiskScale(8)
  .build();
```

**Expected Output**:
- 4-5 orders assigned
- High rider utilization
- Strong SLA compliance
- Avg cost: 0.4-0.6

**What to Look For**:
- How bike and car riders are selected
- Small batch sizes to keep routes efficient
- Rider capacity constraints (bikes: 5kg max, cars: 15kg max)

---

## Example 2: E-Commerce Last-Mile

**File**: `examples/last-mile.ts`

**Scenario**: OnlineShop last-mile fulfillment with cost focus

**Key Features**:
- 9 orders across 2 zones with 24-48 hour SLAs
- 6 riders (3 per zone)
- Cost optimization (35% distance weight)
- Large batch sizes (5 bikes, 12 cars, 30 vans)

**Configuration**:
```typescript
const config = new ConfigurationBuilder()
  .setWeights({
    w1_time: 0.20,
    w2_slaRisk: 0.20,       // Softer SLA (longer windows)
    w3_distance: 0.35,      // Minimize travel distance
    w4_batchDisruption: 0.15,
    w5_workload: 0.08,
    w6_affinity: 0.02,
  })
  .setMaxBatchSizes({ bike: 5, car: 12, van: 30 })
  .build();
```

**Expected Output**:
- 8-9 orders assigned
- Zone-based routing (zone A and zone B separated)
- Large batches to maximize efficiency
- Lower avg cost: 0.3-0.5

**What to Look For**:
- Zone affinity bonus for familiar riders
- Larger batch sizes in this configuration
- Cost-per-assignment breakdown
- Weight utilization per rider

---

## Example 3: Surge Handling

**File**: `examples/surge-handling.ts`

**Scenario**: Managing peak hour demand spikes

**Key Features**:
- Progressive load test: 30 → 150 orders with fixed 20 riders
- Shows surge escalation: normal → soft_surge → hard_surge → crisis
- Demonstrates dynamic action recommendations

**Configuration**:
```typescript
const config = new ConfigurationBuilder()
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
```

**Expected Output**:
- Shows escalation progression as orders increase
- Surge levels: normal, soft_surge, hard_surge, crisis
- Recommended actions (increase batch, expand radius, etc.)
- Success rates decline with higher surge levels

**What to Look For**:
- Surge detection thresholds (1.1x, 1.3x, 1.8x ratios)
- Automatic adjustment of strategies
- Assignment success rates at different load levels
- How the engine recommends actions

---

## Understanding Output

### Assignment Results

```
ASSIGNMENT RESULTS
Assigned: 4 orders
Failed: 1 orders
Avg Cost: 0.500
Total SLA Slack: 139.9998 minutes
```

**Metrics explained**:
- **Assigned**: Number of orders successfully matched to riders
- **Failed**: Orders that could not be assigned (no viable candidates)
- **Avg Cost**: Average cost per assignment (0.0 = optimal, 1.0 = worst)
- **SLA Slack**: Minutes until first order breaches SLA

### Rider Utilization

```
RIDER UTILIZATION:
BIKE001: 1 orders (33% capacity)
CAR001: 2 orders (67% capacity)
```

Shows how much each rider is loaded compared to their max capacity.

### Surge Status

```
SURGE STATUS:
Level: normal
Demand/Supply Ratio: 1.25
Pending Orders: 1
Available Capacity: 5
```

Shows current system state and available capacity for more orders.

---

## Customizing Examples

### Change Order Count

```typescript
// In food-delivery.ts
const orders = createFoodOrders();  // Change 5 to any number

// Or create custom orders
const customOrders = new Map();
customOrders.set('ORD001', { ... });
```

### Change Rider Count

```typescript
const riders = createFoodRiders();  // Modify to change count
```

### Change Configuration

```typescript
// Use different market config
const config = MARKET_CONFIGS.high_sla_priority();
const config = MARKET_CONFIGS.cost_optimized();
```

### Add Logging

```typescript
console.log('Before:', engine.getState().surgeState);
engine.executeCycle();
console.log('After:', engine.getState().surgeState);
```

---

## Comparing Examples

| Aspect | Food Delivery | Last-Mile | Surge Handling |
|--------|---------------|-----------|-----------------|
| **Orders** | 5 | 9 | 30-150 |
| **Riders** | 4 | 6 | 20 (fixed) |
| **SLA Window** | 30-45 min | 24-48 hours | Varies |
| **Focus** | SLA compliance | Cost efficiency | Volume handling |
| **Batch Size** | Small (2-3) | Large (5-30) | Dynamic |
| **Expected Rate** | 80% assigned | 90% assigned | 50-80% assigned |

---

## Next Steps

1. **Run each example**: See how assignment works in different scenarios
2. **Modify and experiment**: Change order/rider counts, adjust weights
3. **Read the code**: Understand data structure creation
4. **Check configuration**: See how different configs affect output
5. **Review tests**: Look at `tests/` for more patterns

---

## More Information

- [Food Delivery Deep Dive](../docs/getting-started.md)
- [Configuration Guide](../docs/configuration.md)
- [Algorithms Explained](../docs/algorithms.md)
- [API Reference](../docs/guide.md)
