import {
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_CANDIDATE_GENERATION_CONFIG,
  DEFAULT_BATCHING_CONFIG,
  DEFAULT_REASSIGNMENT_CONFIG,
  DEFAULT_SURGE_CONFIG,
  DEFAULT_ETA_CONFIG,
  DEFAULT_FATIGUE_CONFIG,
  DEFAULT_SLA_CONFIG,
  DEFAULT_ENGINE_CONFIG,
  ConfigurationBuilder,
  createDefaultConfig,
  MARKET_CONFIGS,
} from '../src/config';

describe('Configuration Defaults', () => {
  describe('DEFAULT_SCORING_WEIGHTS', () => {
    it('should have all required weight keys', () => {
      expect(DEFAULT_SCORING_WEIGHTS).toHaveProperty('w1_time');
      expect(DEFAULT_SCORING_WEIGHTS).toHaveProperty('w2_slaRisk');
      expect(DEFAULT_SCORING_WEIGHTS).toHaveProperty('w3_distance');
      expect(DEFAULT_SCORING_WEIGHTS).toHaveProperty('w4_batchDisruption');
      expect(DEFAULT_SCORING_WEIGHTS).toHaveProperty('w5_workload');
      expect(DEFAULT_SCORING_WEIGHTS).toHaveProperty('w6_affinity');
    });

    it('should have weights that sum to 1.0', () => {
      const sum = Object.values(DEFAULT_SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should have all positive weights', () => {
      Object.values(DEFAULT_SCORING_WEIGHTS).forEach(weight => {
        expect(weight).toBeGreaterThan(0);
      });
    });

    it('should have SLA risk as highest priority', () => {
      expect(DEFAULT_SCORING_WEIGHTS.w2_slaRisk).toBeGreaterThan(
        DEFAULT_SCORING_WEIGHTS.w1_time
      );
    });
  });

  describe('DEFAULT_CANDIDATE_GENERATION_CONFIG', () => {
    it('should have required properties', () => {
      expect(DEFAULT_CANDIDATE_GENERATION_CONFIG).toHaveProperty('initialRadiusKm');
      expect(DEFAULT_CANDIDATE_GENERATION_CONFIG).toHaveProperty('expandedRadiusKm');
      expect(DEFAULT_CANDIDATE_GENERATION_CONFIG).toHaveProperty('maxRadiusKm');
      expect(DEFAULT_CANDIDATE_GENERATION_CONFIG).toHaveProperty('radiusExpansionMinutesThreshold');
    });

    it('should have radius values in increasing order', () => {
      const { initialRadiusKm, expandedRadiusKm, maxRadiusKm } = DEFAULT_CANDIDATE_GENERATION_CONFIG;
      expect(initialRadiusKm).toBeLessThan(expandedRadiusKm);
      expect(expandedRadiusKm).toBeLessThan(maxRadiusKm);
    });

    it('should have reasonable radius values', () => {
      expect(DEFAULT_CANDIDATE_GENERATION_CONFIG.initialRadiusKm).toBeGreaterThan(0);
      expect(DEFAULT_CANDIDATE_GENERATION_CONFIG.maxRadiusKm).toBeLessThan(100);
    });

    it('should have positive threshold', () => {
      expect(DEFAULT_CANDIDATE_GENERATION_CONFIG.radiusExpansionMinutesThreshold).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_BATCHING_CONFIG', () => {
    it('should have required properties', () => {
      expect(DEFAULT_BATCHING_CONFIG).toHaveProperty('maxBatchSize');
      expect(DEFAULT_BATCHING_CONFIG).toHaveProperty('maxBatchDurationMinutes');
      expect(DEFAULT_BATCHING_CONFIG).toHaveProperty('twoOptIterationLimit');
    });

    it('should have all vehicle types in maxBatchSize', () => {
      expect(DEFAULT_BATCHING_CONFIG.maxBatchSize).toHaveProperty('bike');
      expect(DEFAULT_BATCHING_CONFIG.maxBatchSize).toHaveProperty('car');
      expect(DEFAULT_BATCHING_CONFIG.maxBatchSize).toHaveProperty('van');
    });

    it('should have increasing batch sizes by vehicle type', () => {
      const { bike, car, van } = DEFAULT_BATCHING_CONFIG.maxBatchSize;
      expect(bike).toBeLessThan(car);
      expect(car).toBeLessThan(van);
    });

    it('should have positive duration and iteration limits', () => {
      expect(DEFAULT_BATCHING_CONFIG.maxBatchDurationMinutes).toBeGreaterThan(0);
      expect(DEFAULT_BATCHING_CONFIG.twoOptIterationLimit).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_REASSIGNMENT_CONFIG', () => {
    it('should have required properties', () => {
      expect(DEFAULT_REASSIGNMENT_CONFIG).toHaveProperty('maxReassignmentAttempts');
      expect(DEFAULT_REASSIGNMENT_CONFIG).toHaveProperty('suppressionRadiusMeters');
      expect(DEFAULT_REASSIGNMENT_CONFIG).toHaveProperty('triggerEtaSpikeMinutes');
      expect(DEFAULT_REASSIGNMENT_CONFIG).toHaveProperty('triggerHighPrioritySlaCutoffMinutes');
    });

    it('should have positive values', () => {
      Object.values(DEFAULT_REASSIGNMENT_CONFIG).forEach(value => {
        expect(value).toBeGreaterThan(0);
      });
    });

    it('should have reasonable ETA spike threshold', () => {
      expect(DEFAULT_REASSIGNMENT_CONFIG.triggerEtaSpikeMinutes).toBeGreaterThan(0);
      expect(DEFAULT_REASSIGNMENT_CONFIG.triggerEtaSpikeMinutes).toBeLessThan(60);
    });
  });

  describe('DEFAULT_SURGE_CONFIG', () => {
    it('should have required properties', () => {
      expect(DEFAULT_SURGE_CONFIG).toHaveProperty('softSurgeRatio');
      expect(DEFAULT_SURGE_CONFIG).toHaveProperty('hardSurgeRatio');
      expect(DEFAULT_SURGE_CONFIG).toHaveProperty('crisisRatio');
      expect(DEFAULT_SURGE_CONFIG).toHaveProperty('prepositionLookbackMinutes');
      expect(DEFAULT_SURGE_CONFIG).toHaveProperty('batchSizeIncrement');
      expect(DEFAULT_SURGE_CONFIG).toHaveProperty('radiusExpansionFactor');
    });

    it('should have increasing surge ratios', () => {
      expect(DEFAULT_SURGE_CONFIG.softSurgeRatio).toBeLessThan(DEFAULT_SURGE_CONFIG.hardSurgeRatio);
      expect(DEFAULT_SURGE_CONFIG.hardSurgeRatio).toBeLessThan(DEFAULT_SURGE_CONFIG.crisisRatio);
    });

    it('should have all ratios greater than 1.0', () => {
      expect(DEFAULT_SURGE_CONFIG.softSurgeRatio).toBeGreaterThan(1.0);
      expect(DEFAULT_SURGE_CONFIG.hardSurgeRatio).toBeGreaterThan(1.0);
      expect(DEFAULT_SURGE_CONFIG.crisisRatio).toBeGreaterThan(1.0);
    });

    it('should have positive increment and expansion factor', () => {
      expect(DEFAULT_SURGE_CONFIG.batchSizeIncrement).toBeGreaterThan(0);
      expect(DEFAULT_SURGE_CONFIG.radiusExpansionFactor).toBeGreaterThan(1.0);
    });
  });

  describe('DEFAULT_ETA_CONFIG', () => {
    it('should have required properties', () => {
      expect(DEFAULT_ETA_CONFIG).toHaveProperty('trafficApiRefreshSeconds');
      expect(DEFAULT_ETA_CONFIG).toHaveProperty('riderModelRetrainCron');
      expect(DEFAULT_ETA_CONFIG).toHaveProperty('serviceTimeDefaults');
      expect(DEFAULT_ETA_CONFIG).toHaveProperty('etaCacheMinutes');
    });

    it('should have all service type defaults', () => {
      const serviceTypes = [
        'restaurant_pickup',
        'dark_store_pickup',
        'apartment_delivery',
        'ground_floor_delivery',
        'house_delivery',
        'commercial_delivery',
      ];
      serviceTypes.forEach(type => {
        expect(DEFAULT_ETA_CONFIG.serviceTimeDefaults).toHaveProperty(type);
      });
    });

    it('should have positive service times', () => {
      Object.values(DEFAULT_ETA_CONFIG.serviceTimeDefaults).forEach(time => {
        expect(time).toBeGreaterThan(0);
      });
    });

    it('should have valid cron expression', () => {
      expect(DEFAULT_ETA_CONFIG.riderModelRetrainCron).toMatch(/^\d+ \d+ \* \* \*$/);
    });
  });

  describe('DEFAULT_FATIGUE_CONFIG', () => {
    it('should have required properties', () => {
      expect(DEFAULT_FATIGUE_CONFIG).toHaveProperty('maxContinuousDrivingMinutes');
      expect(DEFAULT_FATIGUE_CONFIG).toHaveProperty('mandatoryBreakMinutes');
      expect(DEFAULT_FATIGUE_CONFIG).toHaveProperty('maxShiftDrivingMinutes');
    });

    it('should have positive values', () => {
      Object.values(DEFAULT_FATIGUE_CONFIG).forEach(value => {
        expect(value).toBeGreaterThan(0);
      });
    });

    it('should have shift limit greater than continuous driving limit', () => {
      expect(DEFAULT_FATIGUE_CONFIG.maxShiftDrivingMinutes).toBeGreaterThan(
        DEFAULT_FATIGUE_CONFIG.maxContinuousDrivingMinutes
      );
    });
  });

  describe('DEFAULT_SLA_CONFIG', () => {
    it('should have required properties', () => {
      expect(DEFAULT_SLA_CONFIG).toHaveProperty('nearBreachThresholdMinutes');
      expect(DEFAULT_SLA_CONFIG).toHaveProperty('breachEscalationAlertThresholdPct');
      expect(DEFAULT_SLA_CONFIG).toHaveProperty('slaRiskSigmoidScale');
    });

    it('should have positive values', () => {
      Object.values(DEFAULT_SLA_CONFIG).forEach(value => {
        expect(value).toBeGreaterThan(0);
      });
    });

    it('should have reasonable thresholds', () => {
      expect(DEFAULT_SLA_CONFIG.nearBreachThresholdMinutes).toBeGreaterThan(0);
      expect(DEFAULT_SLA_CONFIG.nearBreachThresholdMinutes).toBeLessThan(120);
    });
  });

  describe('DEFAULT_ENGINE_CONFIG', () => {
    it('should have all sub-configs', () => {
      expect(DEFAULT_ENGINE_CONFIG).toHaveProperty('cycleIntervalSeconds');
      expect(DEFAULT_ENGINE_CONFIG).toHaveProperty('maxOrdersPerCycle');
      expect(DEFAULT_ENGINE_CONFIG).toHaveProperty('maxRidersPerAssignment');
      expect(DEFAULT_ENGINE_CONFIG).toHaveProperty('optimizerTimeoutSeconds');
      expect(DEFAULT_ENGINE_CONFIG).toHaveProperty('hungarianThreshold');
      expect(DEFAULT_ENGINE_CONFIG).toHaveProperty('weights');
      expect(DEFAULT_ENGINE_CONFIG).toHaveProperty('candidateGeneration');
      expect(DEFAULT_ENGINE_CONFIG).toHaveProperty('batching');
      expect(DEFAULT_ENGINE_CONFIG).toHaveProperty('reassignment');
      expect(DEFAULT_ENGINE_CONFIG).toHaveProperty('surge');
      expect(DEFAULT_ENGINE_CONFIG).toHaveProperty('eta');
      expect(DEFAULT_ENGINE_CONFIG).toHaveProperty('fatigue');
      expect(DEFAULT_ENGINE_CONFIG).toHaveProperty('sla');
    });

    it('should reference default configs correctly', () => {
      expect(DEFAULT_ENGINE_CONFIG.weights).toEqual(DEFAULT_SCORING_WEIGHTS);
      expect(DEFAULT_ENGINE_CONFIG.candidateGeneration).toEqual(DEFAULT_CANDIDATE_GENERATION_CONFIG);
      expect(DEFAULT_ENGINE_CONFIG.batching).toEqual(DEFAULT_BATCHING_CONFIG);
    });

    it('should have positive cycle and timeout values', () => {
      expect(DEFAULT_ENGINE_CONFIG.cycleIntervalSeconds).toBeGreaterThan(0);
      expect(DEFAULT_ENGINE_CONFIG.optimizerTimeoutSeconds).toBeGreaterThan(0);
    });
  });
});

describe('ConfigurationBuilder', () => {
  describe('Constructor', () => {
    it('should create default configuration without parameters', () => {
      const builder = new ConfigurationBuilder();
      const config = builder.build();
      expect(config).toEqual(DEFAULT_ENGINE_CONFIG);
    });

    it('should merge partial base config', () => {
      const builder = new ConfigurationBuilder({
        cycleIntervalSeconds: 60,
      });
      const config = builder.build();
      expect(config.cycleIntervalSeconds).toBe(60);
      expect(config.weights).toEqual(DEFAULT_SCORING_WEIGHTS);
    });

    it('should merge partial weights', () => {
      const builder = new ConfigurationBuilder({
        weights: {
          w1_time: 0.5,
          w2_slaRisk: 0.5,
          w3_distance: 0,
          w4_batchDisruption: 0,
          w5_workload: 0,
          w6_affinity: 0,
        },
      });
      const config = builder.build();
      expect(config.weights.w1_time).toBe(0.5);
      expect(config.weights.w2_slaRisk).toBe(0.5);
    });

    it('should merge nested configs', () => {
      const builder = new ConfigurationBuilder({
        batching: {
          maxBatchDurationMinutes: 60,
          maxBatchSize: DEFAULT_BATCHING_CONFIG.maxBatchSize,
          twoOptIterationLimit: DEFAULT_BATCHING_CONFIG.twoOptIterationLimit,
        },
      });
      const config = builder.build();
      expect(config.batching.maxBatchDurationMinutes).toBe(60);
      expect(config.batching.maxBatchSize).toEqual(DEFAULT_BATCHING_CONFIG.maxBatchSize);
    });
  });

  describe('setWeight', () => {
    it('should set single weight in valid config', () => {
      const builder = new ConfigurationBuilder({
        weights: {
          w1_time: 0.5,
          w2_slaRisk: 0.5,
          w3_distance: 0,
          w4_batchDisruption: 0,
          w5_workload: 0,
          w6_affinity: 0,
        },
      });
      const returned = builder.setWeight('w1_time', 0.3).setWeight('w2_slaRisk', 0.7);
      expect(returned).toBe(builder);
      const config = returned.build();
      expect(config.weights.w1_time).toBe(0.3);
    });

    it('should validate weights sum to 1.0 on build', () => {
      const builder = new ConfigurationBuilder();
      builder.setWeight('w1_time', 1.0);
      expect(() => builder.build()).toThrow('Scoring weights must sum to 1.0');
    });
  });

  describe('setWeights', () => {
    it('should set multiple weights at once', () => {
      const builder = new ConfigurationBuilder();
      const config = builder.setWeights({
        w1_time: 0.4,
        w2_slaRisk: 0.4,
        w3_distance: 0.2,
        w4_batchDisruption: 0,
        w5_workload: 0,
        w6_affinity: 0,
      }).build();
      expect(config.weights.w1_time).toBe(0.4);
      expect(config.weights.w2_slaRisk).toBe(0.4);
    });

    it('should merge with existing weights', () => {
      const builder = new ConfigurationBuilder();
      const config = builder.setWeights({
        w1_time: 0.4,
        w2_slaRisk: 0.4,
        w3_distance: 0.2,
        w4_batchDisruption: 0,
        w5_workload: 0,
        w6_affinity: 0,
      }).build();
      expect(config.weights.w1_time).toBe(0.4);
      expect(config.weights.w3_distance).toBe(0.2);
    });

    it('should return builder for chaining', () => {
      const builder = new ConfigurationBuilder();
      const returned = builder.setWeights({
        w1_time: 0.4,
      });
      expect(returned).toBe(builder);
    });
  });

  describe('setCycleInterval', () => {
    it('should set cycle interval seconds', () => {
      const config = new ConfigurationBuilder()
        .setCycleInterval(15)
        .build();
      expect(config.cycleIntervalSeconds).toBe(15);
    });

    it('should return builder for chaining', () => {
      const builder = new ConfigurationBuilder();
      const returned = builder.setCycleInterval(15);
      expect(returned).toBe(builder);
    });
  });

  describe('setSLARiskScale', () => {
    it('should set SLA risk sigmoid scale', () => {
      const config = new ConfigurationBuilder()
        .setSLARiskScale(15)
        .build();
      expect(config.sla.slaRiskSigmoidScale).toBe(15);
    });

    it('should return builder for chaining', () => {
      const builder = new ConfigurationBuilder();
      const returned = builder.setSLARiskScale(15);
      expect(returned).toBe(builder);
    });
  });

  describe('setSurgeRatios', () => {
    it('should set all surge ratios', () => {
      const config = new ConfigurationBuilder()
        .setSurgeRatios(1.1, 1.3, 1.8)
        .build();
      expect(config.surge.softSurgeRatio).toBe(1.1);
      expect(config.surge.hardSurgeRatio).toBe(1.3);
      expect(config.surge.crisisRatio).toBe(1.8);
    });

    it('should return builder for chaining', () => {
      const builder = new ConfigurationBuilder();
      const returned = builder.setSurgeRatios(1.1, 1.3, 1.8);
      expect(returned).toBe(builder);
    });
  });

  describe('setMaxBatchSizes', () => {
    it('should set batch sizes for vehicle types', () => {
      const config = new ConfigurationBuilder()
        .setMaxBatchSizes({
          bike: 2,
          car: 4,
          van: 6,
        })
        .build();
      expect(config.batching.maxBatchSize.bike).toBe(2);
      expect(config.batching.maxBatchSize.car).toBe(4);
      expect(config.batching.maxBatchSize.van).toBe(6);
    });

    it('should return builder for chaining', () => {
      const builder = new ConfigurationBuilder();
      const returned = builder.setMaxBatchSizes({
        bike: 2,
        car: 4,
        van: 6,
      });
      expect(returned).toBe(builder);
    });
  });

  describe('build', () => {
    it('should return valid configuration when weights sum to 1.0', () => {
      const config = new ConfigurationBuilder().build();
      const sum = Object.values(config.weights).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
    });

    it('should throw error when weights do not sum to 1.0', () => {
      const builder = new ConfigurationBuilder()
        .setWeight('w1_time', 0.5)
        .setWeight('w2_slaRisk', 0.5);
      expect(() => builder.build()).toThrow('Scoring weights must sum to 1.0');
    });

    it('should return immutable config', () => {
      const config = new ConfigurationBuilder().build();
      (config as any).cycleIntervalSeconds = 999;
      const config2 = new ConfigurationBuilder().build();
      expect(config2.cycleIntervalSeconds).not.toBe(999);
    });

    it('should preserve all nested configs in final result', () => {
      const config = new ConfigurationBuilder()
        .setCycleInterval(45)
        .setSurgeRatios(1.1, 1.3, 1.8)
        .build();
      expect(config.cycleIntervalSeconds).toBe(45);
      expect(config.surge.softSurgeRatio).toBe(1.1);
      expect(config.weights).toBeDefined();
    });
  });

  describe('Method Chaining', () => {
    it('should support complex chaining', () => {
      const config = new ConfigurationBuilder()
        .setCycleInterval(20)
        .setWeights({
          w1_time: 0.35,
          w2_slaRisk: 0.35,
          w3_distance: 0.2,
          w4_batchDisruption: 0.1,
          w5_workload: 0,
          w6_affinity: 0,
        })
        .setSurgeRatios(1.15, 1.35, 1.85)
        .build();
      expect(config.cycleIntervalSeconds).toBe(20);
      expect(config.weights.w1_time).toBe(0.35);
      expect(config.surge.softSurgeRatio).toBe(1.15);
    });

    it('should support multiple setWeights calls', () => {
      const config = new ConfigurationBuilder()
        .setWeights({ w1_time: 0.25 })
        .setWeights({ w2_slaRisk: 0.40 })
        .build();
      expect(config.weights.w1_time).toBe(0.25);
      expect(config.weights.w2_slaRisk).toBe(0.40);
    });
  });
});

describe('createDefaultConfig', () => {
  it('should return default engine config', () => {
    const config = createDefaultConfig();
    expect(config).toEqual(DEFAULT_ENGINE_CONFIG);
  });

  it('should be equivalent to new ConfigurationBuilder().build()', () => {
    const config1 = createDefaultConfig();
    const config2 = new ConfigurationBuilder().build();
    expect(config1).toEqual(config2);
  });

  it('should have valid weights', () => {
    const config = createDefaultConfig();
    const sum = Object.values(config.weights).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
  });
});

describe('MARKET_CONFIGS', () => {
  describe('bangalore_default', () => {
    it('should return valid configuration', () => {
      const config = MARKET_CONFIGS.bangalore_default();
      const sum = Object.values(config.weights).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
    });

    it('should match default weights', () => {
      const config = MARKET_CONFIGS.bangalore_default();
      expect(config.weights).toEqual(DEFAULT_SCORING_WEIGHTS);
    });

    it('should use default sub-configs', () => {
      const config = MARKET_CONFIGS.bangalore_default();
      expect(config.batching).toEqual(DEFAULT_BATCHING_CONFIG);
      expect(config.surge).toEqual(DEFAULT_SURGE_CONFIG);
    });
  });

  describe('high_sla_priority', () => {
    it('should return valid configuration', () => {
      const config = MARKET_CONFIGS.high_sla_priority();
      const sum = Object.values(config.weights).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
    });

    it('should prioritize SLA risk', () => {
      const config = MARKET_CONFIGS.high_sla_priority();
      expect(config.weights.w2_slaRisk).toBe(0.5);
    });

    it('should reduce distance weight', () => {
      const config = MARKET_CONFIGS.high_sla_priority();
      expect(config.weights.w3_distance).toBe(0.1);
      expect(config.weights.w3_distance).toBeLessThan(DEFAULT_SCORING_WEIGHTS.w3_distance);
    });

    it('should preserve other weights', () => {
      const config = MARKET_CONFIGS.high_sla_priority();
      expect(config.weights.w1_time).toBeGreaterThan(0);
      expect(config.weights.w4_batchDisruption).toBeGreaterThan(0);
    });
  });

  describe('surge_optimized', () => {
    it('should return valid configuration', () => {
      const config = MARKET_CONFIGS.surge_optimized();
      const sum = Object.values(config.weights).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
    });

    it('should reduce workload weight', () => {
      const config = MARKET_CONFIGS.surge_optimized();
      expect(config.weights.w5_workload).toBe(0.02);
      expect(config.weights.w5_workload).toBeLessThan(DEFAULT_SCORING_WEIGHTS.w5_workload);
    });

    it('should set optimized surge ratios', () => {
      const config = MARKET_CONFIGS.surge_optimized();
      expect(config.surge.softSurgeRatio).toBe(1.1);
      expect(config.surge.hardSurgeRatio).toBe(1.3);
      expect(config.surge.crisisRatio).toBe(1.8);
    });

    it('should have lower surge thresholds than default', () => {
      const config = MARKET_CONFIGS.surge_optimized();
      const defaultConfig = MARKET_CONFIGS.bangalore_default();
      expect(config.surge.softSurgeRatio).toBeLessThan(defaultConfig.surge.softSurgeRatio);
    });
  });

  describe('cost_optimized', () => {
    it('should return valid configuration', () => {
      const config = MARKET_CONFIGS.cost_optimized();
      const sum = Object.values(config.weights).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
    });

    it('should prioritize distance and SLA equally', () => {
      const config = MARKET_CONFIGS.cost_optimized();
      expect(config.weights.w3_distance).toBe(0.25);
      expect(config.weights.w2_slaRisk).toBe(0.25);
    });

    it('should increase distance weight from default', () => {
      const config = MARKET_CONFIGS.cost_optimized();
      expect(config.weights.w3_distance).toBeGreaterThan(DEFAULT_SCORING_WEIGHTS.w3_distance);
    });

    it('should preserve other weights', () => {
      const config = MARKET_CONFIGS.cost_optimized();
      expect(config.weights.w1_time).toBeGreaterThan(0);
      expect(config.weights.w4_batchDisruption).toBeGreaterThan(0);
    });
  });

  describe('Market Config Consistency', () => {
    it('should all return valid engine configs', () => {
      Object.entries(MARKET_CONFIGS).forEach(([, factory]) => {
        const config = factory();
        const sum = Object.values(config.weights).reduce((a, b) => a + b, 0);
        expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
        expect(config).toHaveProperty('cycleIntervalSeconds');
        expect(config).toHaveProperty('batching');
      });
    });

    it('should have distinct configurations', () => {
      const bangalore = MARKET_CONFIGS.bangalore_default();
      const highSla = MARKET_CONFIGS.high_sla_priority();
      const surge = MARKET_CONFIGS.surge_optimized();
      const cost = MARKET_CONFIGS.cost_optimized();

      const configs = [bangalore, highSla, surge, cost];
      const weights = configs.map(c => JSON.stringify(c.weights));
      const unique = new Set(weights);
      expect(unique.size).toBeGreaterThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero weights correctly after validation', () => {
      const config = new ConfigurationBuilder({
        weights: {
          w1_time: 0.0,
          w2_slaRisk: 1.0,
          w3_distance: 0.0,
          w4_batchDisruption: 0.0,
          w5_workload: 0.0,
          w6_affinity: 0.0,
        },
      }).build();
      expect(config.weights.w1_time).toBe(0.0);
      expect(config.weights.w2_slaRisk).toBe(1.0);
    });

    it('should preserve numeric precision in weights', () => {
      const config = new ConfigurationBuilder()
        .setWeights({
          w1_time: 0.333333,
          w2_slaRisk: 0.333333,
          w3_distance: 0.333334,
          w4_batchDisruption: 0,
          w5_workload: 0,
          w6_affinity: 0,
        })
        .build();
      const sum = Object.values(config.weights).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
    });

    it('should handle large timeout values', () => {
      const config = new ConfigurationBuilder({
        optimizerTimeoutSeconds: 10,
      }).build();
      expect(config.optimizerTimeoutSeconds).toBe(10);
    });

    it('should handle large batch sizes', () => {
      const config = new ConfigurationBuilder()
        .setMaxBatchSizes({ bike: 10, car: 20, van: 30 })
        .build();
      expect(config.batching.maxBatchSize.van).toBe(30);
    });
  });
});
