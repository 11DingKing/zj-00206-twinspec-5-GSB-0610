import type { VehicleClass } from '../types';
import { PairStatus } from '../types';
import {
  calculateClassStatistics,
  calculateOverallStatistics,
  calculateCauseStatistics,
  calculatePairTypeStatistics,
  calculateBatteryCorrelationGroups,
  deduplicatePairsByVehicle,
  formatExtremePair,
  ClassStatistics,
  CauseStatistics,
  PairTypeStatistics,
  ExtremePair,
} from '../utils/pairMetrics';
import {
  findPairedPairs,
  findExtremeWeightGainPairs,
  findPairedPairsWithFullEv,
  findPairedPairsForCauseStats,
  findPairedPairsForPairTypeStats,
  countPairsByStatus,
  countVehiclesByPowerType,
  findPairsByClass,
} from '../repositories/pairRepository';

export { ExtremePair, CauseStatistics, ClassStatistics, PairTypeStatistics };

export interface ChainStatistics {
  totalChains: number;
  threeVersionChains: number;
  twoVersionChains: number;
  avgTotalWeightGainKg: number;
  byClass: {
    vehicleClass: string;
    count: number;
    threeVersionCount: number;
    avgTotalWeightGainKg: number;
  }[];
}

export async function getExtremeWeightGains(limit: number = 10): Promise<ExtremePair[]> {
  const pairs = await findExtremeWeightGainPairs(limit);
  const { uniquePairs } = deduplicatePairsByVehicle(pairs);
  return uniquePairs.slice(0, limit).map((pair) => formatExtremePair(pair));
}

export async function getClassWiseStatistics(): Promise<ClassStatistics[]> {
  const pairs = await findPairedPairs();
  return calculateClassStatistics(pairs);
}

export async function getOverallStatistics() {
  const pairs = await findPairedPairs();
  const overallStats = calculateOverallStatistics(pairs);

  const [pendingCount, reviewCount, totalVehicles, iceCount, evCount] = await Promise.all([
    countPairsByStatus(PairStatus.PENDING),
    countPairsByStatus(PairStatus.REVIEW),
    countVehiclesByPowerType(),
    countVehiclesByPowerType('ICE'),
    countVehiclesByPowerType('EV'),
  ]);

  return {
    ...overallStats,
    statusCounts: {
      pending: pendingCount,
      paired: overallStats.totalPairs,
      review: reviewCount,
    },
    vehicleCounts: {
      total: totalVehicles,
      ice: iceCount,
      ev: evCount,
    },
  };
}

export async function getBatteryCorrelationAnalysis() {
  const pairs = await findPairedPairsWithFullEv();
  return calculateBatteryCorrelationGroups(pairs);
}

export async function getPairsByClass(
  vehicleClass?: VehicleClass,
  includeVehicles: boolean = true,
) {
  return findPairsByClass(vehicleClass, includeVehicles);
}

export async function getCauseStatistics(): Promise<CauseStatistics[]> {
  const pairs = await findPairedPairsForCauseStats();
  return calculateCauseStatistics(pairs);
}

export async function getPairTypeStatistics(): Promise<PairTypeStatistics[]> {
  const pairs = await findPairedPairsForPairTypeStats();
  return calculatePairTypeStatistics(pairs);
}

export async function getChainStatistics(): Promise<ChainStatistics> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const chains = await prisma.chainComparison.findMany({
    where: { status: 'ACTIVE' },
    include: { items: true },
  });

  let totalThreeVersion = 0;
  let totalTwoVersion = 0;
  const totalGains: number[] = [];
  const byClass: Record<string, { count: number; threeVersionCount: number; totalGain: number }> =
    {};

  chains.forEach((chain) => {
    if (!byClass[chain.vehicleClass]) {
      byClass[chain.vehicleClass] = {
        count: 0,
        threeVersionCount: 0,
        totalGain: 0,
      };
    }
    byClass[chain.vehicleClass].count++;

    const sortedItems = [...chain.items].sort((a, b) => a.sequence - b.sequence);
    const baseWeight = sortedItems[0]?.curbWeight || 0;
    const evWeight = sortedItems.find((i) => i.powerType === 'EV')?.curbWeight;
    if (evWeight) {
      const gain = evWeight - baseWeight;
      totalGains.push(gain);
      byClass[chain.vehicleClass].totalGain += gain;
    }

    if (chain.items.length >= 3) {
      totalThreeVersion++;
      byClass[chain.vehicleClass].threeVersionCount++;
    } else {
      totalTwoVersion++;
    }
  });

  const byClassResult = Object.entries(byClass).map(([vehicleClass, data]) => ({
    vehicleClass,
    count: data.count,
    threeVersionCount: data.threeVersionCount,
    avgTotalWeightGainKg: data.count > 0 ? Math.round((data.totalGain / data.count) * 10) / 10 : 0,
  }));

  return {
    totalChains: chains.length,
    threeVersionChains: totalThreeVersion,
    twoVersionChains: totalTwoVersion,
    avgTotalWeightGainKg:
      totalGains.length > 0
        ? Math.round((totalGains.reduce((a, b) => a + b, 0) / totalGains.length) * 10) / 10
        : 0,
    byClass: byClassResult,
  };
}
