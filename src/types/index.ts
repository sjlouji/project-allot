export interface Location {
  lat: number;
  lng: number;
  updatedAt?: Date;
}

export interface Address {
  street: string;
  city: string;
  postalCode: string;
  buildingType?: 'apartment' | 'ground_floor' | 'house' | 'commercial';
}

export interface OrderPickup {
  location: Location;
  address: Address;
  storeId: string;
  estimatedPickupWaitMinutes: number;
  availability?: {
    open: string;
    close: string;
  };
}

export interface OrderDelivery {
  location: Location;
  address: Address;
  customerId: string;
  preferredDeliveryWindow?: {
    startMinutes: number;
    endMinutes: number;
  };
}

export interface OrderPayload {
  weightKg: number;
  volumeLiters: number;
  itemCount: number;
  requiresColdChain: boolean;
  fragile: boolean;
  vehicleRequirement: 'any' | 'bike' | 'car' | 'van' | 'refrigerated';
}

export type OrderPriority = 'normal' | 'high' | 'critical';
export type OrderStatus = 'pending_assignment' | 'assigned' | 'picked_up' | 'delivered' | 'cancelled';

export interface Order {
  orderId: string;
  status: OrderStatus;
  createdAt: Date;
  slaDeadline: Date;
  pickup: OrderPickup;
  delivery: OrderDelivery;
  payload: OrderPayload;
  priority: OrderPriority;
  assignmentAttempts: number;
  assignedRiderId: string | null;
}

export type RiderStatus = 'active' | 'on_delivery' | 'break' | 'offline';
export type VehicleType = 'bike' | 'car' | 'van';
export type VehicleCapability = 'standard' | 'fragile' | 'cold_chain';

export interface Vehicle {
  type: VehicleType;
  maxWeightKg: number;
  maxVolumeLiters: number;
  maxItems: number;
  capabilities: VehicleCapability[];
}

export interface RiderShift {
  startTime: Date;
  endTime: Date;
  continuousDrivingMinutes: number;
  totalShiftDrivingMinutes: number;
}

export interface RiderLoad {
  weightKg: number;
  volumeLiters: number;
  itemCount: number;
}

export interface RiderPerformance {
  zoneFamiliarityScores: Record<string, number>;
  avgDeliverySuccessRate: number;
  avgSpeedMultiplier: number;
  totalDeliveries: number;
  avgCustomerRating?: number;
}

export interface Rider {
  riderId: string;
  status: RiderStatus;
  location: Location;
  vehicle: Vehicle;
  shift: RiderShift;
  currentAssignments: string[];
  currentRoute: RouteStop[];
  load: RiderLoad;
  performance: RiderPerformance;
}

export interface RouteStop {
  type: 'pickup' | 'delivery';
  orderId: string;
  location: Location;
  sequenceIndex: number;
  estimatedArrivalTime?: Date;
  estimatedDepartureTime?: Date;
}

export interface AssignmentCostBreakdown {
  deltaTimeCost: number;
  slaRiskCost: number;
  distanceCost: number;
  batchDisruptionCost: number;
  workloadImbalanceCost: number;
  affinityCost: number;
  totalWeightedCost: number;
}

export type AssignmentStatus = 'dispatched' | 'accepted' | 'rejected' | 'reassigned' | 'completed';

export interface Assignment {
  assignmentId: string;
  orderId: string;
  riderId: string;
  assignedAt: Date;
  cycleId: string;
  costBreakdown: AssignmentCostBreakdown;
  estimatedPickupAt: Date;
  estimatedDeliveryAt: Date;
  slaDeadline: Date;
  slaSlackMinutes: number;
  reassignmentCount: number;
  status: AssignmentStatus;
}

export interface CandidateGenerationResult {
  orderId: string;
  candidateRiderIds: string[];
  failureReason?: string;
}

export interface ScoringResult {
  orderId: string;
  riderId: string;
  cost: number;
  costBreakdown: AssignmentCostBreakdown;
}

export interface AssignmentDecision {
  orderId: string;
  riderId: string;
  sequenceIndex: number;
}

export interface AssignmentCycleResult {
  cycleId: string;
  timestamp: Date;
  decisions: AssignmentDecision[];
  successCount: number;
  failureCount: number;
  metrics: {
    avgCost: number;
    totalSlaSlackMinutes: number;
    riderUtilization: Record<string, number>;
  };
}

export interface ReassignmentTrigger {
  type: 'rider_offline' | 'eta_spike' | 'high_priority_arrival' | 'rider_rejection' | 'order_modification' | 'new_rider_online';
  affectedOrderIds: string[];
  affectedRiderIds: string[];
  reason: string;
  timestamp: Date;
}

export interface ReassignmentEvent {
  triggerId: string;
  trigger: ReassignmentTrigger;
  priorAssignments: Map<string, string>;
  newAssignments: Map<string, string>;
  changedOrderIds: string[];
  costDifference: number;
}

export type SurgeLevel = 'normal' | 'soft_surge' | 'hard_surge' | 'crisis';

export interface SurgeState {
  level: SurgeLevel;
  demandSupplyRatio: number;
  pendingOrderCount: number;
  availableCapacity: number;
  recommendedActions: string[];
}

export interface ETAEstimate {
  origin: Location;
  destination: Location;
  departureTime: Date;
  estimatedDurationMinutes: number;
  confidence: number;
  baseTime: number;
  trafficMultiplier: number;
  riderSpeedMultiplier: number;
  serviceTimeMinutes: number;
}

export interface ScoringWeights {
  w1_time: number;
  w2_slaRisk: number;
  w3_distance: number;
  w4_batchDisruption: number;
  w5_workload: number;
  w6_affinity: number;
}

export interface CandidateGenerationConfig {
  initialRadiusKm: number;
  expandedRadiusKm: number;
  maxRadiusKm: number;
  radiusExpansionMinutesThreshold: number;
}

export interface BatchingConfig {
  maxBatchSize: Record<VehicleType, number>;
  maxBatchDurationMinutes: number;
  twoOptIterationLimit: number;
}

export interface ReassignmentConfig {
  maxReassignmentAttempts: number;
  suppressionRadiusMeters: number;
  triggerEtaSpikeMinutes: number;
  triggerHighPrioritySlaCutoffMinutes: number;
}

export interface SurgeConfig {
  softSurgeRatio: number;
  hardSurgeRatio: number;
  crisisRatio: number;
  prepositionLookbackMinutes: number;
  batchSizeIncrement: number;
  radiusExpansionFactor: number;
}

export interface ETAConfig {
  trafficApiRefreshSeconds: number;
  riderModelRetrainCron: string;
  serviceTimeDefaults: Record<string, number>;
  etaCacheMinutes: number;
}

export interface FatigueConfig {
  maxContinuousDrivingMinutes: number;
  mandatoryBreakMinutes: number;
  maxShiftDrivingMinutes: number;
}

export interface SLAConfig {
  nearBreachThresholdMinutes: number;
  breachEscalationAlertThresholdPct: number;
  slaRiskSigmoidScale: number;
}

export interface AssignmentEngineConfig {
  cycleIntervalSeconds: number;
  maxOrdersPerCycle: number;
  maxRidersPerAssignment: number;
  optimizerTimeoutSeconds: number;
  hungarianThreshold: number;
  weights: ScoringWeights;
  candidateGeneration: CandidateGenerationConfig;
  batching: BatchingConfig;
  reassignment: ReassignmentConfig;
  surge: SurgeConfig;
  eta: ETAConfig;
  fatigue: FatigueConfig;
  sla: SLAConfig;
}

export interface AssignmentEngineState {
  orders: Map<string, Order>;
  riders: Map<string, Rider>;
  assignments: Map<string, Assignment>;
  cycleHistory: AssignmentCycleResult[];
  reassignmentHistory: ReassignmentEvent[];
  lastCycleTimestamp: Date;
  surgeState: SurgeState;
}

export interface ETAInput {
  origin: Location;
  destination: Location;
  departureTime: Date;
  riderId?: string;
  buildingType?: string;
}
