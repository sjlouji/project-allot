import { Order, Rider, RouteStop, BatchingConfig } from '../types';
import { haversineDistance, calculateRouteTotalDistance } from '../utils/geospatial';

export interface BatchRoute {
  stops: RouteStop[];
  totalDistance: number;
  totalDurationMinutes: number;
  ordersSequence: string[];
}

export class BatchOptimizer {
  constructor(private config: BatchingConfig) {}

  public optimizeBatch(rider: Rider, orders: Order[]): BatchRoute {
    if (orders.length === 0) {
      return {
        stops: [],
        totalDistance: 0,
        totalDurationMinutes: 0,
        ordersSequence: [],
      };
    }

    const passConstraints = this.validateBatchConstraints(rider, orders);
    if (!passConstraints) {
    }

    let route = this.cheapestInsertionConstruction(rider, orders);

    route = this.twoOptImprovement(route);

    const stops = this.buildStopSequence(route);

    return {
      stops,
      totalDistance: calculateRouteTotalDistance(stops.map(s => s.location)),
      totalDurationMinutes: route.duration,
      ordersSequence: route.orders,
    };
  }

  private validateBatchConstraints(rider: Rider, orders: Order[]): boolean {
    const maxBatchSize = this.config.maxBatchSize[rider.vehicle.type];

    if (orders.length > maxBatchSize) {
      return false;
    }

    let totalWeight = 0;
    let totalVolume = 0;
    let totalItems = 0;

    for (const order of orders) {
      totalWeight += order.payload.weightKg;
      totalVolume += order.payload.volumeLiters;
      totalItems += order.payload.itemCount;
    }

    return (
      totalWeight <= rider.vehicle.maxWeightKg &&
      totalVolume <= rider.vehicle.maxVolumeLiters &&
      totalItems <= rider.vehicle.maxItems
    );
  }

  private cheapestInsertionConstruction(rider: Rider, orders: Order[]): PartialRoute {
    const { index: nearestIdx } = this.findNearestOrder(
      rider.location,
      orders
    );

    const remainingOrders = new Set(Array.from({ length: orders.length }, (_, i) => i));
    remainingOrders.delete(nearestIdx);

    const route: PartialRoute = {
      orders: [orders[nearestIdx].orderId],
      duration: this.estimateRouteDuration([orders[nearestIdx]]),
      distance: 0,
    };

    while (remainingOrders.size > 0) {
      let bestOrderIdx = -1;
      let bestIncrementalCost = Infinity;
      let bestInsertPosition = 0;

      for (const orderIdx of remainingOrders) {
        const order = orders[orderIdx];

        for (let insertPos = 0; insertPos <= route.orders.length; insertPos++) {
          const incrementalCost = this.calculateInsertionCost(route, order, insertPos, orders);

          if (incrementalCost < bestIncrementalCost) {
            bestIncrementalCost = incrementalCost;
            bestOrderIdx = orderIdx;
            bestInsertPosition = insertPos;
          }
        }
      }

      if (bestOrderIdx === -1) {
        break;
      }

      const order = orders[bestOrderIdx];
      route.orders.splice(bestInsertPosition, 0, order.orderId);
      route.duration = this.estimateRouteDuration(
        route.orders.map(orderId => orders.find(o => o.orderId === orderId)!).filter(Boolean)
      );

      remainingOrders.delete(bestOrderIdx);
    }

    return route;
  }

  private findNearestOrder(location: { lat: number; lng: number }, orders: Order[]) {
    let minDistance = Infinity;
    let nearestIdx = 0;

    for (let i = 0; i < orders.length; i++) {
      const distance = haversineDistance(location, orders[i].pickup.location);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIdx = i;
      }
    }

    return { location: orders[nearestIdx].pickup.location, index: nearestIdx };
  }

  /**
   * Calculate insertion cost for adding an order to the route
   */
  private calculateInsertionCost(
    route: PartialRoute,
    order: Order,
    insertPosition: number,
    allOrders: Order[]
  ): number {

    const orderIndices = route.orders.map(orderId => allOrders.findIndex(o => o.orderId === orderId));

    if (orderIndices.length === 0) {
      return 0;
    }

    const prevIdx = insertPosition === 0 ? -1 : orderIndices[insertPosition - 1];
    const nextIdx = insertPosition < orderIndices.length ? orderIndices[insertPosition] : -1;

    let detourDistance = 0;

    if (prevIdx !== -1) {
      const prevOrder = allOrders[prevIdx];
      detourDistance += haversineDistance(prevOrder.delivery.location, order.pickup.location);
      detourDistance += haversineDistance(order.pickup.location, order.delivery.location);

      if (nextIdx !== -1) {
        const nextOrder = allOrders[nextIdx];
        detourDistance -= haversineDistance(prevOrder.delivery.location, nextOrder.pickup.location);
      }
    } else {
      detourDistance = haversineDistance(order.pickup.location, order.delivery.location);
    }

    return detourDistance;
  }

  private twoOptImprovement(route: PartialRoute): PartialRoute {
    const orders = route.orders.map(orderId => orderId);
    let improved = true;
    let iteration = 0;

    while (improved && iteration < this.config.twoOptIterationLimit) {
      improved = false;
      iteration++;

      for (let i = 0; i < orders.length - 1; i++) {
        for (let j = i + 2; j < orders.length; j++) {
          const newRoute = [...orders.slice(0, i + 1), ...orders.slice(i + 1, j + 1).reverse(), ...orders.slice(j + 1)];

          improved = true;
          orders.splice(0, orders.length, ...newRoute);
          break;
        }
        if (improved) break;
      }
    }

    return {
      ...route,
      orders,
    };
  }

  private estimateRouteDuration(orders: Order[]): number {
    if (orders.length === 0) return 0;

    let totalMinutes = 0;

    for (let i = 0; i < orders.length; i++) {
      totalMinutes += orders[i].pickup.estimatedPickupWaitMinutes;

      totalMinutes += 10;

      totalMinutes += 3;

      if (i < orders.length - 1) {
        totalMinutes += 10;
      }
    }

    return totalMinutes;
  }

  private buildStopSequence(route: PartialRoute): RouteStop[] {
    const stops: RouteStop[] = [];
    let sequenceIndex = 0;

    for (const orderId of route.orders) {
      stops.push({
        type: 'pickup',
        orderId,
        location: { lat: 0, lng: 0 },
        sequenceIndex: sequenceIndex++,
      });

      stops.push({
        type: 'delivery',
        orderId,
        location: { lat: 0, lng: 0 },
        sequenceIndex: sequenceIndex++,
      });
    }

    return stops;
  }
}

interface PartialRoute {
  orders: string[];
  duration: number;
  distance: number;
}
