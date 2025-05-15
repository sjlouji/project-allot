import { Location } from '../types';

export function haversineDistance(loc1: Location, loc2: Location): number {
  const R = 6371;
  const lat1 = (loc1.lat * Math.PI) / 180;
  const lat2 = (loc2.lat * Math.PI) / 180;
  const deltaLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const deltaLng = ((loc2.lng - loc1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function estimateTravelTime(
  origin: Location,
  destination: Location,
  averageSpeedKmh: number = 25,
  trafficFactor: number = 1.2
): number {
  const distanceKm = haversineDistance(origin, destination);
  const baseTimeMinutes = (distanceKm / averageSpeedKmh) * 60;
  const withTraffic = baseTimeMinutes * trafficFactor;
  return Math.round(withTraffic);
}

export function getLocationCell(location: Location, resolution: number = 2): string {
  const cellSize = 180 / Math.pow(2, resolution);
  const cellLat = Math.floor(location.lat / cellSize) * cellSize;
  const cellLng = Math.floor(location.lng / cellSize) * cellSize;
  return `${cellLat}:${cellLng}`;
}

export function findRidersWithinRadius(
  targetLocation: Location,
  riderLocations: Map<string, Location>,
  radiusKm: number
): string[] {
  const result: string[] = [];
  for (const [riderId, riderLocation] of riderLocations) {
    const distance = haversineDistance(targetLocation, riderLocation);
    if (distance <= radiusKm) {
      result.push(riderId);
    }
  }
  return result;
}

export function calculateZoneProximity(
  loc1: Location,
  loc2: Location,
  zoneRadiusKm: number = 5
): number {
  const distance = haversineDistance(loc1, loc2);
  if (distance > zoneRadiusKm) {
    return 0;
  }
  return 1.0 - distance / zoneRadiusKm;
}

export function calculateCenterOfMass(locations: Location[]): Location {
  if (locations.length === 0) {
    throw new Error('Cannot calculate center of mass for empty location set');
  }

  const avgLat = locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length;
  const avgLng = locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length;

  return { lat: avgLat, lng: avgLng };
}

export function isLocationInPolygon(point: Location, polygon: Location[]): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let isInside = false;
  let p1 = polygon[0];

  for (let i = 1; i <= polygon.length; i++) {
    const p2 = polygon[i % polygon.length];

    if (
      point.lng >
      ((p2.lng - p1.lng) * (point.lat - p1.lat)) / (p2.lat - p1.lat) + p1.lng
    ) {
      isInside = !isInside;
    }
    p1 = p2;
  }

  return isInside;
}

export function findNearestLocation(
  source: Location,
  candidates: Location[]
): { location: Location; index: number; distance: number } {
  if (candidates.length === 0) {
    throw new Error('Cannot find nearest location in empty set');
  }

  let minDistance = Infinity;
  let nearestIndex = 0;
  let nearestLocation = candidates[0];

  for (let i = 0; i < candidates.length; i++) {
    const distance = haversineDistance(source, candidates[i]);
    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = i;
      nearestLocation = candidates[i];
    }
  }

  return { location: nearestLocation, index: nearestIndex, distance: minDistance };
}

export function calculateRouteTotalDistance(locations: Location[]): number {
  if (locations.length < 2) {
    return 0;
  }

  let totalDistance = 0;
  for (let i = 0; i < locations.length - 1; i++) {
    totalDistance += haversineDistance(locations[i], locations[i + 1]);
  }
  return totalDistance;
}
