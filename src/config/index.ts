import {
  AssignmentEngineConfig,
  ScoringWeights,
  CandidateGenerationConfig,
  BatchingConfig,
  ReassignmentConfig,
  SurgeConfig,
  ETAConfig,
  FatigueConfig,
  SLAConfig,
} from '../types';

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  w1_time: 0.30,
  w2_slaRisk: 0.35,
  w3_distance: 0.15,
  w4_batchDisruption: 0.12,
  w5_workload: 0.05,
  w6_affinity: 0.03,
};

export const DEFAULT_CANDIDATE_GENERATION_CONFIG: CandidateGenerationConfig = {
  initialRadiusKm: 5,
  expandedRadiusKm: 10,
  maxRadiusKm: 20,
  radiusExpansionMinutesThreshold: 20,
};

export const DEFAULT_BATCHING_CONFIG: BatchingConfig = {
  maxBatchSize: {
    bike: 3,
    car: 5,
    van: 8,
  },
  maxBatchDurationMinutes: 45,
  twoOptIterationLimit: 100,
};

export const DEFAULT_REASSIGNMENT_CONFIG: ReassignmentConfig = {
  maxReassignmentAttempts: 3,
  suppressionRadiusMeters: 500,
  triggerEtaSpikeMinutes: 15,
  triggerHighPrioritySlaCutoffMinutes: 20,
};

export const DEFAULT_SURGE_CONFIG: SurgeConfig = {
  softSurgeRatio: 1.2,
  hardSurgeRatio: 1.5,
  crisisRatio: 2.0,
  prepositionLookbackMinutes: 30,
  batchSizeIncrement: 1,
  radiusExpansionFactor: 1.5,
};

export const DEFAULT_ETA_CONFIG: ETAConfig = {
  trafficApiRefreshSeconds: 60,
  riderModelRetrainCron: '0 2 * * *',
  serviceTimeDefaults: {
    restaurant_pickup: 5,
    dark_store_pickup: 2,
    apartment_delivery: 4,
    ground_floor_delivery: 2,
    house_delivery: 3,
    commercial_delivery: 2,
  },
  etaCacheMinutes: 5,
};

export const DEFAULT_FATIGUE_CONFIG: FatigueConfig = {
  maxContinuousDrivingMinutes: 120,
  mandatoryBreakMinutes: 15,
  maxShiftDrivingMinutes: 480,
};

export const DEFAULT_SLA_CONFIG: SLAConfig = {
  nearBreachThresholdMinutes: 20,
  breachEscalationAlertThresholdPct: 2.0,
  slaRiskSigmoidScale: 10,
};

export const DEFAULT_ENGINE_CONFIG: AssignmentEngineConfig = {
  cycleIntervalSeconds: 30,
  maxOrdersPerCycle: 500,
  maxRidersPerAssignment: 150,
  optimizerTimeoutSeconds: 1.5,
  hungarianThreshold: 10000,
  weights: DEFAULT_SCORING_WEIGHTS,
  candidateGeneration: DEFAULT_CANDIDATE_GENERATION_CONFIG,
  batching: DEFAULT_BATCHING_CONFIG,
  reassignment: DEFAULT_REASSIGNMENT_CONFIG,
  surge: DEFAULT_SURGE_CONFIG,
  eta: DEFAULT_ETA_CONFIG,
  fatigue: DEFAULT_FATIGUE_CONFIG,
  sla: DEFAULT_SLA_CONFIG,
};

export class ConfigurationBuilder {
  private config: AssignmentEngineConfig;

  constructor(baseConfig: Partial<AssignmentEngineConfig> = {}) {
    this.config = {
      ...DEFAULT_ENGINE_CONFIG,
      ...baseConfig,
      weights: {
        ...DEFAULT_SCORING_WEIGHTS,
        ...(baseConfig.weights || {}),
      },
      candidateGeneration: {
        ...DEFAULT_CANDIDATE_GENERATION_CONFIG,
        ...(baseConfig.candidateGeneration || {}),
      },
      batching: {
        ...DEFAULT_BATCHING_CONFIG,
        ...(baseConfig.batching || {}),
      },
      reassignment: {
        ...DEFAULT_REASSIGNMENT_CONFIG,
        ...(baseConfig.reassignment || {}),
      },
      surge: {
        ...DEFAULT_SURGE_CONFIG,
        ...(baseConfig.surge || {}),
      },
      eta: {
        ...DEFAULT_ETA_CONFIG,
        ...(baseConfig.eta || {}),
      },
      fatigue: {
        ...DEFAULT_FATIGUE_CONFIG,
        ...(baseConfig.fatigue || {}),
      },
      sla: {
        ...DEFAULT_SLA_CONFIG,
        ...(baseConfig.sla || {}),
      },
    };
  }

  setWeight(key: keyof ScoringWeights, value: number): ConfigurationBuilder {
    this.config.weights[key] = value;
    return this;
  }

  setWeights(weights: Partial<ScoringWeights>): ConfigurationBuilder {
    this.config.weights = { ...this.config.weights, ...weights };
    return this;
  }

  setCycleInterval(seconds: number): ConfigurationBuilder {
    this.config.cycleIntervalSeconds = seconds;
    return this;
  }

  setSLARiskScale(scale: number): ConfigurationBuilder {
    this.config.sla.slaRiskSigmoidScale = scale;
    return this;
  }

  setSurgeRatios(softRatio: number, hardRatio: number, crisisRatio: number): ConfigurationBuilder {
    this.config.surge.softSurgeRatio = softRatio;
    this.config.surge.hardSurgeRatio = hardRatio;
    this.config.surge.crisisRatio = crisisRatio;
    return this;
  }

  setMaxBatchSizes(batchSizes: Record<string, number>): ConfigurationBuilder {
    this.config.batching.maxBatchSize = batchSizes as any;
    return this;
  }

  build(): AssignmentEngineConfig {
    const weightSum = Object.values(this.config.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      throw new Error(`Scoring weights must sum to 1.0, got ${weightSum.toFixed(3)}`);
    }

    return this.config;
  }
}

export function createDefaultConfig(): AssignmentEngineConfig {
  return new ConfigurationBuilder().build();
}

export const MARKET_CONFIGS = {
  bangalore_default: (): AssignmentEngineConfig => {
    return new ConfigurationBuilder({
      weights: {
        w1_time: 0.30,
        w2_slaRisk: 0.35,
        w3_distance: 0.15,
        w4_batchDisruption: 0.12,
        w5_workload: 0.05,
        w6_affinity: 0.03,
      },
    }).build();
  },

  high_sla_priority: (): AssignmentEngineConfig => {
    return new ConfigurationBuilder({
      weights: {
        w1_time: 0.25,
        w2_slaRisk: 0.50,
        w3_distance: 0.10,
        w4_batchDisruption: 0.10,
        w5_workload: 0.05,
        w6_affinity: 0.00,
      },
    }).build();
  },

  surge_optimized: (): AssignmentEngineConfig => {
    return new ConfigurationBuilder({
      weights: {
        w1_time: 0.30,
        w2_slaRisk: 0.35,
        w3_distance: 0.15,
        w4_batchDisruption: 0.16,
        w5_workload: 0.02,
        w6_affinity: 0.02,
      },
      surge: {
        softSurgeRatio: 1.1,
        hardSurgeRatio: 1.3,
        crisisRatio: 1.8,
        prepositionLookbackMinutes: 30,
        batchSizeIncrement: 1,
        radiusExpansionFactor: 1.5,
      },
    }).build();
  },

  cost_optimized: (): AssignmentEngineConfig => {
    return new ConfigurationBuilder({
      weights: {
        w1_time: 0.25,
        w2_slaRisk: 0.25,
        w3_distance: 0.25,
        w4_batchDisruption: 0.15,
        w5_workload: 0.05,
        w6_affinity: 0.05,
      },
    }).build();
  },
};
// Market specific configs
