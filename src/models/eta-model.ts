import { ETAConfig, Location, ETAEstimate } from '../types';
import { estimateTravelTime } from '../utils/geospatial';

export class ETAModel {
  private config: ETAConfig;
  private etaCache: Map<string, { estimate: ETAEstimate; timestamp: Date }> = new Map();
  private riderModelCache: Map<string, RiderETAModel> = new Map();

  constructor(config: ETAConfig) {
    this.config = config;
  }

  private generateCacheKey(
    origin: Location,
    destination: Location,
    departureTime: Date
  ): string {
    const departureMinute = Math.floor(departureTime.getTime() / 60000);
    return `${origin.lat.toFixed(4)}:${origin.lng.toFixed(4)}:${destination.lat.toFixed(4)}:${destination.lng.toFixed(4)}:${departureMinute}`;
  }

  public estimateETA(
    origin: Location,
    destination: Location,
    departureTime: Date,
    riderId?: string,
    buildingType?: string
  ): ETAEstimate {
    const cacheKey = this.generateCacheKey(origin, destination, departureTime);
    const cached = this.etaCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp.getTime() < this.config.etaCacheMinutes * 60 * 1000) {
      return cached.estimate;
    }

    const baseTime = estimateTravelTime(origin, destination, 25, 1.0);

    const hour = departureTime.getHours();
    const trafficMultiplier = this.getTrafficMultiplier(hour);

    let riderSpeedMultiplier = 1.0;
    if (riderId) {
      riderSpeedMultiplier = this.getRiderSpeedMultiplier(riderId);
    }

    let serviceTime = 0;
    if (buildingType) {
      serviceTime = this.config.serviceTimeDefaults[buildingType] || 3;
    }

    const travelTime = Math.round(baseTime * trafficMultiplier * riderSpeedMultiplier);
    const totalTime = travelTime + serviceTime;

    const estimate: ETAEstimate = {
      origin,
      destination,
      departureTime,
      estimatedDurationMinutes: totalTime,
      confidence: 0.75 + Math.random() * 0.2,
      baseTime,
      trafficMultiplier,
      riderSpeedMultiplier,
      serviceTimeMinutes: serviceTime,
    };

    this.etaCache.set(cacheKey, { estimate, timestamp: new Date() });

    return estimate;
  }

  private getTrafficMultiplier(hour: number): number {
    if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19)) {
      return 1.5;
    }
    if (hour >= 22 || hour <= 6) {
      return 1.1;
    }
    return 1.0;
  }

  private getRiderSpeedMultiplier(riderId: string): number {
    const cached = this.riderModelCache.get(riderId);
    if (cached) {
      return cached.speedMultiplier;
    }

    const multiplier = 0.8 + Math.random() * 0.4;
    const model: RiderETAModel = {
      riderId,
      speedMultiplier: multiplier,
      familiarZones: new Set(),
      trainingDatapoints: 0,
      lastUpdated: new Date(),
    };

    this.riderModelCache.set(riderId, model);
    return multiplier;
  }

  public updateRiderModel(
    riderId: string,
    actualDurationMinutes: number,
    estimatedDurationMinutes: number,
    zone: string
  ): void {
    let model = this.riderModelCache.get(riderId);

    if (!model) {
      model = {
        riderId,
        speedMultiplier: 1.0,
        familiarZones: new Set(),
        trainingDatapoints: 0,
        lastUpdated: new Date(),
      };
    }

    const actualMultiplier = estimatedDurationMinutes / Math.max(actualDurationMinutes, 1);
    const alpha = 0.1;
    model.speedMultiplier = model.speedMultiplier * (1 - alpha) + actualMultiplier * alpha;
    model.familiarZones.add(zone);
    model.trainingDatapoints++;
    model.lastUpdated = new Date();

    this.riderModelCache.set(riderId, model);
  }

  /**
   * Estimate ETA for a sequence of locations (route)
   * Useful for evaluating batch sequences
   */
  public estimateRouteETA(
    locations: Location[],
    startTime: Date,
    riderId?: string
  ): { totalMinutes: number; breakdown: number[] } {
    if (locations.length < 2) {
      return { totalMinutes: 0, breakdown: [] };
    }

    const breakdown: number[] = [];
    let currentTime = startTime;

    for (let i = 0; i < locations.length - 1; i++) {
      const estimate = this.estimateETA(locations[i], locations[i + 1], currentTime, riderId);
      breakdown.push(estimate.estimatedDurationMinutes);
      currentTime = new Date(currentTime.getTime() + estimate.estimatedDurationMinutes * 60 * 1000);
    }

    const totalMinutes = breakdown.reduce((sum, d) => sum + d, 0);
    return { totalMinutes, breakdown };
  }

  public clearExpiredCache(): void {
    const now = Date.now();
    const expirationMs = this.config.etaCacheMinutes * 60 * 1000;

    for (const [key, value] of this.etaCache) {
      if (now - value.timestamp.getTime() > expirationMs) {
        this.etaCache.delete(key);
      }
    }
  }

  public getCacheStats(): { cacheSize: number; riderModels: number } {
    return {
      cacheSize: this.etaCache.size,
      riderModels: this.riderModelCache.size,
    };
  }
}

interface RiderETAModel {
  riderId: string;
  speedMultiplier: number;
  familiarZones: Set<string>;
  trainingDatapoints: number;
  lastUpdated: Date;
}
