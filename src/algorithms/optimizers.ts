export interface AssignmentMatrix {
  orders: string[];
  riders: string[];
  costMatrix: number[][];
}

export interface OptimizationResult {
  assignments: Map<string, string>; // orderId -> riderId
  totalCost: number;
  algorithm: 'hungarian' | 'auction' | 'greedy';
}

export class HungarianOptimizer {
  public optimize(matrix: AssignmentMatrix): OptimizationResult {
    const n = matrix.orders.length;
    const m = matrix.riders.length;

    const maxDim = Math.max(n, m);
    const paddedCosts = this.padCostMatrix(matrix.costMatrix, n, m, maxDim);

    const assignment = this.hungarianAlgorithm(paddedCosts);

    const assignments = new Map<string, string>();
    let totalCost = 0;

    for (let orderIdx = 0; orderIdx < n; orderIdx++) {
      const riderIdx = assignment[orderIdx];
      if (riderIdx < m) {
        assignments.set(matrix.orders[orderIdx], matrix.riders[riderIdx]);
        totalCost += matrix.costMatrix[orderIdx][riderIdx];
      }
    }

    return {
      assignments,
      totalCost,
      algorithm: 'hungarian',
    };
  }

  private padCostMatrix(costs: number[][], n: number, m: number, maxDim: number): number[][] {
    const padded: number[][] = [];
    const infinity = 1e10;

    for (let i = 0; i < maxDim; i++) {
      padded[i] = [];
      for (let j = 0; j < maxDim; j++) {
        if (i < n && j < m) {
          padded[i][j] = costs[i][j];
        } else {
          padded[i][j] = infinity;
        }
      }
    }

    return padded;
  }

  private hungarianAlgorithm(costs: number[][]): number[] {
    const n = costs.length;
    const u = Array(n + 1).fill(0);
    const v = Array(n + 1).fill(0);
    const p = Array(n + 1).fill(0);
    const way = Array(n + 1).fill(0);

    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = Array(n + 1).fill(1e10);
      const used = Array(n + 1).fill(false);

      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = 1e10;
        let j1 = 0;

        for (let j = 1; j <= n; j++) {
          if (!used[j]) {
            const cur = costs[i0 - 1][j - 1] - u[i0] - v[j];
            if (cur < minv[j]) {
              minv[j] = cur;
              way[j] = j0;
            }
            if (minv[j] < delta) {
              delta = minv[j];
              j1 = j;
            }
          }
        }

        for (let j = 0; j <= n; j++) {
          if (used[j]) {
            u[p[j]] += delta;
            v[j] -= delta;
          } else {
            minv[j] -= delta;
          }
        }

        j0 = j1;
      } while (p[j0] !== 0);

      do {
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
      } while (j0);
    }

    const result = Array(n);
    for (let j = 1; j <= n; j++) {
      result[p[j] - 1] = j - 1;
    }

    return result;
  }
}

export class AuctionOptimizer {
  private epsilon: number = 0.01;
  private maxIterations: number = 1000;

  public optimize(matrix: AssignmentMatrix): OptimizationResult {
    const n = matrix.orders.length;
    const m = matrix.riders.length;

    const prices = Array(m).fill(0);
    const assignments = Array(n).fill(-1);
    let unassignedOrders = new Set(Array.from({ length: n }, (_, i) => i));

    let iteration = 0;
    while (unassignedOrders.size > 0 && iteration < this.maxIterations) {
      const bids = new Map<number, { orderIdx: number; bid: number }>();

      for (const orderIdx of unassignedOrders) {
        let bestRider = 0;
        let bestValue = -Infinity;

        for (let riderIdx = 0; riderIdx < m; riderIdx++) {
          const value = -matrix.costMatrix[orderIdx][riderIdx] - prices[riderIdx];
          if (value > bestValue) {
            bestValue = value;
            bestRider = riderIdx;
          }
        }

        let secondBestValue = -Infinity;
        for (let riderIdx = 0; riderIdx < m; riderIdx++) {
          if (riderIdx !== bestRider) {
            const value = -matrix.costMatrix[orderIdx][riderIdx] - prices[riderIdx];
            secondBestValue = Math.max(secondBestValue, value);
          }
        }

        const bidAmount = -matrix.costMatrix[orderIdx][bestRider] - secondBestValue + this.epsilon;
        const currentBid = bids.get(bestRider);

        if (!currentBid || bidAmount > currentBid.bid) {
          bids.set(bestRider, { orderIdx, bid: bidAmount });
        }
      }

      unassignedOrders.clear();
      for (const [riderIdx, { orderIdx, bid }] of bids) {
        for (let i = 0; i < n; i++) {
          if (assignments[i] === riderIdx) {
            unassignedOrders.add(i);
            break;
          }
        }

        assignments[orderIdx] = riderIdx;
        prices[riderIdx] += bid;
      }

      iteration++;
    }

    const resultAssignments = new Map<string, string>();
    let totalCost = 0;

    for (let orderIdx = 0; orderIdx < n; orderIdx++) {
      const riderIdx = assignments[orderIdx];
      if (riderIdx !== -1 && riderIdx < m) {
        resultAssignments.set(matrix.orders[orderIdx], matrix.riders[riderIdx]);
        totalCost += matrix.costMatrix[orderIdx][riderIdx];
      }
    }

    return {
      assignments: resultAssignments,
      totalCost,
      algorithm: 'auction',
    };
  }
}

export class GreedyOptimizer {
  public optimize(matrix: AssignmentMatrix): OptimizationResult {
    const n = matrix.orders.length;
    const m = matrix.riders.length;

    const riderAssignmentCount = Array(m).fill(0);

    const assignments = new Map<string, string>();
    let totalCost = 0;

    for (let orderIdx = 0; orderIdx < n; orderIdx++) {
      let bestRider = 0;
      let bestCost = Infinity;

      for (let riderIdx = 0; riderIdx < m; riderIdx++) {
        if (matrix.costMatrix[orderIdx][riderIdx] < bestCost) {
          bestCost = matrix.costMatrix[orderIdx][riderIdx];
          bestRider = riderIdx;
        }
      }

      assignments.set(matrix.orders[orderIdx], matrix.riders[bestRider]);
      riderAssignmentCount[bestRider]++;
      totalCost += bestCost;
    }

    return {
      assignments,
      totalCost,
      algorithm: 'greedy',
    };
  }
}

export class AdaptiveOptimizer {
  private hungarian = new HungarianOptimizer();
  private auction = new AuctionOptimizer();
  private greedy = new GreedyOptimizer();

  public optimize(
    matrix: AssignmentMatrix,
    hungarianThreshold: number = 10000
  ): OptimizationResult {
    const problemSize = matrix.orders.length * matrix.riders.length;

    if (problemSize <= hungarianThreshold) {
      try {
        return this.hungarian.optimize(matrix);
      } catch (error) {
      }
    }

    if (problemSize <= 50000) {
      try {
        return this.auction.optimize(matrix);
      } catch (error) {
      }
    }

    return this.greedy.optimize(matrix);
  }
}
// Performance optimizations
