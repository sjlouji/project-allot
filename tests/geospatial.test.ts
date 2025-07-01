import {
  haversineDistance,
  estimateTravelTime,
  getLocationCell,
  findRidersWithinRadius,
  calculateZoneProximity,
  calculateCenterOfMass,
  isLocationInPolygon,
  findNearestLocation,
  calculateRouteTotalDistance,
} from '../src/utils/geospatial';
import { Location } from '../src/types';

describe('Geospatial Utilities', () => {
  describe('haversineDistance', () => {
    it('should calculate distance between two identical locations as zero', () => {
      const loc1: Location = { lat: 40.7128, lng: -74.006 };
      const distance = haversineDistance(loc1, loc1);
      expect(distance).toBeCloseTo(0, 1);
    });

    it('should calculate approximate distance between NYC and LA', () => {
      const nyc: Location = { lat: 40.7128, lng: -74.006 };
      const la: Location = { lat: 34.0522, lng: -118.2437 };
      const distance = haversineDistance(nyc, la);
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4100);
    });

    it('should calculate distance between nearby locations (within 1km)', () => {
      const loc1: Location = { lat: 40.7128, lng: -74.006 };
      const loc2: Location = { lat: 40.7129, lng: -74.006 };
      const distance = haversineDistance(loc1, loc2);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(0.2);
    });

    it('should handle equatorial locations', () => {
      const loc1: Location = { lat: 0, lng: 0 };
      const loc2: Location = { lat: 0, lng: 1 };
      const distance = haversineDistance(loc1, loc2);
      expect(distance).toBeGreaterThan(110);
      expect(distance).toBeLessThan(112);
    });

    it('should be symmetric', () => {
      const loc1: Location = { lat: 40.7128, lng: -74.006 };
      const loc2: Location = { lat: 34.0522, lng: -118.2437 };
      const d1 = haversineDistance(loc1, loc2);
      const d2 = haversineDistance(loc2, loc1);
      expect(d1).toBeCloseTo(d2, 5);
    });

    it('should handle negative latitudes and longitudes', () => {
      const loc1: Location = { lat: -33.8688, lng: 151.2093 };
      const loc2: Location = { lat: -33.8688, lng: 151.2094 };
      const distance = haversineDistance(loc1, loc2);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(0.01);
    });
  });

  describe('estimateTravelTime', () => {
    it('should estimate travel time with default parameters', () => {
      const origin: Location = { lat: 0, lng: 0 };
      const destination: Location = { lat: 0, lng: 1 };
      const time = estimateTravelTime(origin, destination);
      expect(time).toBeGreaterThan(0);
      expect(typeof time).toBe('number');
    });

    it('should return shorter time for higher speed', () => {
      const origin: Location = { lat: 40.7128, lng: -74.006 };
      const destination: Location = { lat: 40.7228, lng: -74.006 };
      const timeSlow = estimateTravelTime(origin, destination, 10);
      const timeFast = estimateTravelTime(origin, destination, 50);
      expect(timeSlow).toBeGreaterThan(timeFast);
    });

    it('should apply traffic factor correctly', () => {
      const origin: Location = { lat: 0, lng: 0 };
      const destination: Location = { lat: 0, lng: 1 };
      const timeNoTraffic = estimateTravelTime(origin, destination, 25, 1.0);
      const timeWithTraffic = estimateTravelTime(origin, destination, 25, 1.5);
      expect(timeWithTraffic).toBeGreaterThan(timeNoTraffic);
    });

    it('should return zero time for same location', () => {
      const loc: Location = { lat: 40.7128, lng: -74.006 };
      const time = estimateTravelTime(loc, loc);
      expect(time).toBe(0);
    });

    it('should return rounded integer time', () => {
      const origin: Location = { lat: 0, lng: 0 };
      const destination: Location = { lat: 0.5, lng: 0.5 };
      const time = estimateTravelTime(origin, destination);
      expect(Number.isInteger(time)).toBe(true);
    });

    it('should increase with distance', () => {
      const origin: Location = { lat: 0, lng: 0 };
      const nearDest: Location = { lat: 0, lng: 0.1 };
      const farDest: Location = { lat: 0, lng: 1 };
      const timeNear = estimateTravelTime(origin, nearDest);
      const timeFar = estimateTravelTime(origin, farDest);
      expect(timeFar).toBeGreaterThan(timeNear);
    });
  });

  describe('getLocationCell', () => {
    it('should return consistent cell for same location', () => {
      const loc: Location = { lat: 40.7128, lng: -74.006 };
      const cell1 = getLocationCell(loc);
      const cell2 = getLocationCell(loc);
      expect(cell1).toBe(cell2);
    });

    it('should return different cells for distant locations', () => {
      const loc1: Location = { lat: 40.7128, lng: -74.006 };
      const loc2: Location = { lat: 34.0522, lng: -118.2437 };
      const cell1 = getLocationCell(loc1);
      const cell2 = getLocationCell(loc2);
      expect(cell1).not.toBe(cell2);
    });

    it('should return cell format as "lat:lng"', () => {
      const loc: Location = { lat: 40.7128, lng: -74.006 };
      const cell = getLocationCell(loc);
      expect(cell).toMatch(/^-?\d+\.?\d*:-?\d+\.?\d*$/);
      expect(cell).toContain(':');
    });

    it('should handle resolution parameter', () => {
      const loc: Location = { lat: 45.5, lng: 120.5 };
      const cellRes1 = getLocationCell(loc, 1);
      const cellRes2 = getLocationCell(loc, 2);
      const cellRes3 = getLocationCell(loc, 3);
      expect(cellRes1).not.toBe(cellRes2);
      expect(cellRes2).not.toBe(cellRes3);
    });

    it('should group nearby locations into same cell at low resolution', () => {
      const loc1: Location = { lat: 40.7, lng: -74.0 };
      const loc2: Location = { lat: 40.71, lng: -74.01 };
      const cell1 = getLocationCell(loc1, 1);
      const cell2 = getLocationCell(loc2, 1);
      expect(cell1).toBe(cell2);
    });

    it('should handle negative coordinates', () => {
      const loc: Location = { lat: -33.8688, lng: 151.2093 };
      const cell = getLocationCell(loc);
      expect(cell).toContain(':');
    });
  });

  describe('findRidersWithinRadius', () => {
    const targetLocation: Location = { lat: 0, lng: 0 };

    it('should return empty array when no riders within radius', () => {
      const riderLocations = new Map<string, Location>([
        ['rider1', { lat: 10, lng: 10 }],
        ['rider2', { lat: 20, lng: 20 }],
      ]);
      const result = findRidersWithinRadius(targetLocation, riderLocations, 1);
      expect(result).toEqual([]);
    });

    it('should return all riders within radius', () => {
      const riderLocations = new Map<string, Location>([
        ['rider1', { lat: 0, lng: 0.001 }],
        ['rider2', { lat: 0.001, lng: 0 }],
      ]);
      const result = findRidersWithinRadius(targetLocation, riderLocations, 10);
      expect(result).toHaveLength(2);
      expect(result).toContain('rider1');
      expect(result).toContain('rider2');
    });

    it('should handle mixed riders within and outside radius', () => {
      const riderLocations = new Map<string, Location>([
        ['rider1', { lat: 0, lng: 0.001 }],
        ['rider2', { lat: 20, lng: 20 }],
      ]);
      const result = findRidersWithinRadius(targetLocation, riderLocations, 10);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('rider1');
    });

    it('should return rider within large radius', () => {
      const riderLocations = new Map<string, Location>([
        ['rider1', { lat: 0, lng: 0.01 }],
      ]);
      const result = findRidersWithinRadius(targetLocation, riderLocations, 5);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('rider1');
    });

    it('should handle empty rider locations', () => {
      const riderLocations = new Map<string, Location>();
      const result = findRidersWithinRadius(targetLocation, riderLocations, 10);
      expect(result).toEqual([]);
    });

    it('should handle target location at 0,0', () => {
      const riderLocations = new Map<string, Location>([
        ['rider1', { lat: 0.001, lng: 0.001 }],
      ]);
      const result = findRidersWithinRadius(targetLocation, riderLocations, 1);
      expect(result).toHaveLength(1);
    });
  });

  describe('calculateZoneProximity', () => {
    it('should return 1.0 for identical locations', () => {
      const loc: Location = { lat: 40.7128, lng: -74.006 };
      const proximity = calculateZoneProximity(loc, loc);
      expect(proximity).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for locations outside zone radius', () => {
      const loc1: Location = { lat: 0, lng: 0 };
      const loc2: Location = { lat: 10, lng: 10 };
      const proximity = calculateZoneProximity(loc1, loc2, 1);
      expect(proximity).toBe(0);
    });

    it('should return value between 0 and 1 for locations within zone', () => {
      const loc1: Location = { lat: 0, lng: 0 };
      const loc2: Location = { lat: 0.01, lng: 0 };
      const proximity = calculateZoneProximity(loc1, loc2, 5);
      expect(proximity).toBeGreaterThan(0);
      expect(proximity).toBeLessThan(1);
    });

    it('should decrease with distance within zone radius', () => {
      const loc1: Location = { lat: 0, lng: 0 };
      const locNear: Location = { lat: 0, lng: 0.001 };
      const locFar: Location = { lat: 0, lng: 0.01 };
      const proximityNear = calculateZoneProximity(loc1, locNear, 5);
      const proximityFar = calculateZoneProximity(loc1, locFar, 5);
      expect(proximityNear).toBeGreaterThan(proximityFar);
    });

    it('should respect custom zone radius', () => {
      const loc1: Location = { lat: 0, lng: 0 };
      const loc2: Location = { lat: 0, lng: 0.01 };
      const proximitySmall = calculateZoneProximity(loc1, loc2, 0.5);
      const proximityLarge = calculateZoneProximity(loc1, loc2, 5);
      expect(proximitySmall).toBe(0);
      expect(proximityLarge).toBeGreaterThan(0);
    });
  });

  describe('calculateCenterOfMass', () => {
    it('should return same location for single location', () => {
      const locations: Location[] = [{ lat: 40.7128, lng: -74.006 }];
      const center = calculateCenterOfMass(locations);
      expect(center.lat).toBeCloseTo(40.7128, 5);
      expect(center.lng).toBeCloseTo(-74.006, 5);
    });

    it('should calculate midpoint for two locations', () => {
      const locations: Location[] = [
        { lat: 0, lng: 0 },
        { lat: 2, lng: 2 },
      ];
      const center = calculateCenterOfMass(locations);
      expect(center.lat).toBeCloseTo(1, 5);
      expect(center.lng).toBeCloseTo(1, 5);
    });

    it('should calculate average for multiple locations', () => {
      const locations: Location[] = [
        { lat: 0, lng: 0 },
        { lat: 3, lng: 3 },
        { lat: 6, lng: 6 },
      ];
      const center = calculateCenterOfMass(locations);
      expect(center.lat).toBeCloseTo(3, 5);
      expect(center.lng).toBeCloseTo(3, 5);
    });

    it('should throw error for empty array', () => {
      expect(() => calculateCenterOfMass([])).toThrow(
        'Cannot calculate center of mass for empty location set'
      );
    });

    it('should handle negative coordinates', () => {
      const locations: Location[] = [
        { lat: -10, lng: -20 },
        { lat: 10, lng: 20 },
      ];
      const center = calculateCenterOfMass(locations);
      expect(center.lat).toBeCloseTo(0, 5);
      expect(center.lng).toBeCloseTo(0, 5);
    });

    it('should handle single cluster of locations', () => {
      const locations: Location[] = [
        { lat: 40.7, lng: -74.0 },
        { lat: 40.71, lng: -73.99 },
        { lat: 40.72, lng: -74.01 },
      ];
      const center = calculateCenterOfMass(locations);
      expect(center.lat).toBeCloseTo(40.71, 2);
      expect(center.lng).toBeCloseTo(-74.0, 2);
    });
  });

  describe('isLocationInPolygon', () => {
    const polygonSquare: Location[] = [
      { lat: 0, lng: 0 },
      { lat: 10, lng: 0 },
      { lat: 10, lng: 10 },
      { lat: 0, lng: 10 },
    ];

    it('should return false for polygon with fewer than 3 points', () => {
      const polygon: Location[] = [
        { lat: 0, lng: 0 },
        { lat: 10, lng: 0 },
      ];
      const result = isLocationInPolygon({ lat: 5, lng: 5 }, polygon);
      expect(result).toBe(false);
    });

    it('should return true for point inside polygon', () => {
      const point: Location = { lat: 5, lng: 5 };
      const result = isLocationInPolygon(point, polygonSquare);
      expect(result).toBe(true);
    });

    it('should return boolean result for polygon point test', () => {
      const point: Location = { lat: 20, lng: 20 };
      const result = isLocationInPolygon(point, polygonSquare);
      expect(typeof result).toBe('boolean');
    });

    it('should handle triangular polygon', () => {
      const triangle: Location[] = [
        { lat: 0, lng: 0 },
        { lat: 10, lng: 0 },
        { lat: 5, lng: 10 },
      ];
      const insidePoint: Location = { lat: 5, lng: 3 };
      expect(isLocationInPolygon(insidePoint, triangle)).toBe(true);
    });

    it('should handle point on polygon edge', () => {
      const point: Location = { lat: 5, lng: 0 };
      const result = isLocationInPolygon(point, polygonSquare);
      expect(typeof result).toBe('boolean');
    });

    it('should handle complex polygon', () => {
      const complexPolygon: Location[] = [
        { lat: 0, lng: 0 },
        { lat: 20, lng: 0 },
        { lat: 20, lng: 20 },
        { lat: 10, lng: 15 },
        { lat: 0, lng: 20 },
      ];
      const insidePoint: Location = { lat: 10, lng: 10 };
      expect(isLocationInPolygon(insidePoint, complexPolygon)).toBe(true);
    });
  });

  describe('findNearestLocation', () => {
    it('should throw error for empty candidates', () => {
      const source: Location = { lat: 0, lng: 0 };
      expect(() => findNearestLocation(source, [])).toThrow(
        'Cannot find nearest location in empty set'
      );
    });

    it('should return the only candidate', () => {
      const source: Location = { lat: 0, lng: 0 };
      const candidates: Location[] = [{ lat: 5, lng: 5 }];
      const result = findNearestLocation(source, candidates);
      expect(result.location).toEqual(candidates[0]);
      expect(result.index).toBe(0);
      expect(result.distance).toBeGreaterThan(0);
    });

    it('should return nearest candidate from multiple options', () => {
      const source: Location = { lat: 0, lng: 0 };
      const candidates: Location[] = [
        { lat: 10, lng: 10 },
        { lat: 1, lng: 1 },
        { lat: 20, lng: 20 },
      ];
      const result = findNearestLocation(source, candidates);
      expect(result.location).toEqual(candidates[1]);
      expect(result.index).toBe(1);
    });

    it('should return zero distance for identical location', () => {
      const loc: Location = { lat: 40.7128, lng: -74.006 };
      const candidates: Location[] = [loc, { lat: 50, lng: 50 }];
      const result = findNearestLocation(loc, candidates);
      expect(result.distance).toBeCloseTo(0, 1);
      expect(result.index).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const source: Location = { lat: -10, lng: -10 };
      const candidates: Location[] = [
        { lat: 0, lng: 0 },
        { lat: -11, lng: -11 },
      ];
      const result = findNearestLocation(source, candidates);
      expect(result.index).toBe(1);
    });

    it('should return all required fields', () => {
      const source: Location = { lat: 0, lng: 0 };
      const candidates: Location[] = [{ lat: 5, lng: 5 }];
      const result = findNearestLocation(source, candidates);
      expect(result).toHaveProperty('location');
      expect(result).toHaveProperty('index');
      expect(result).toHaveProperty('distance');
    });
  });

  describe('calculateRouteTotalDistance', () => {
    it('should return 0 for single location', () => {
      const locations: Location[] = [{ lat: 0, lng: 0 }];
      const distance = calculateRouteTotalDistance(locations);
      expect(distance).toBe(0);
    });

    it('should return 0 for empty route', () => {
      const distance = calculateRouteTotalDistance([]);
      expect(distance).toBe(0);
    });

    it('should calculate distance for two-point route', () => {
      const locations: Location[] = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
      ];
      const distance = calculateRouteTotalDistance(locations);
      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(200);
    });

    it('should sum distances for multi-point route', () => {
      const locations: Location[] = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 0, lng: 2 },
      ];
      const distance = calculateRouteTotalDistance(locations);
      expect(distance).toBeGreaterThan(200);
      expect(distance).toBeLessThan(300);
    });

    it('should return same distance for reverse route', () => {
      const forward: Location[] = [
        { lat: 0, lng: 0 },
        { lat: 1, lng: 1 },
        { lat: 2, lng: 2 },
      ];
      const backward = [...forward].reverse();
      const distanceForward = calculateRouteTotalDistance(forward);
      const distanceBackward = calculateRouteTotalDistance(backward);
      expect(distanceForward).toBeCloseTo(distanceBackward, 5);
    });

    it('should handle circular route', () => {
      const locations: Location[] = [
        { lat: 0, lng: 0 },
        { lat: 1, lng: 0 },
        { lat: 1, lng: 1 },
        { lat: 0, lng: 1 },
      ];
      const distance = calculateRouteTotalDistance(locations);
      expect(distance).toBeGreaterThan(300);
      expect(distance).toBeLessThan(400);
    });

    it('should handle identical consecutive locations', () => {
      const locations: Location[] = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 0 },
        { lat: 1, lng: 1 },
      ];
      const distance = calculateRouteTotalDistance(locations);
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle equatorial and polar locations', () => {
      const equator: Location = { lat: 0, lng: 0 };
      const nearPole: Location = { lat: 89, lng: 0 };
      const distance = haversineDistance(equator, nearPole);
      expect(distance).toBeGreaterThan(9800);
      expect(distance).toBeLessThan(10100);
    });

    it('should handle international date line crossing', () => {
      const westPacific: Location = { lat: 0, lng: 179 };
      const eastPacific: Location = { lat: 0, lng: -179 };
      const distance = haversineDistance(westPacific, eastPacific);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(300);
    });

    it('should be consistent between different utility functions', () => {
      const loc1: Location = { lat: 40.7128, lng: -74.006 };
      const loc2: Location = { lat: 40.7228, lng: -74.006 };
      const distance = haversineDistance(loc1, loc2);
      const travelTime = estimateTravelTime(loc1, loc2);
      expect(distance).toBeGreaterThan(0);
      expect(travelTime).toBeGreaterThan(0);
    });
  });
});
