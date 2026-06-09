import { parseCauseTags } from './weightCalculator';

export interface PairWithVehicleIds {
  id: number;
  iceVehicleId: number | null;
  phevVehicleId: number | null;
  evVehicleId: number | null;
  matchScore: number | null;
  weightDiffKg: number | null;
  weightGainPct: number | null;
  normalizedDiff: number | null;
  primaryCause: string | null;
  causeTags: string | null;
  notes: string | null;
  [key: string]: any;
}

export function getVehicleIdsFromPair(pair: PairWithVehicleIds): number[] {
  return [pair.iceVehicleId, pair.phevVehicleId, pair.evVehicleId].filter(
    (id): id is number => id !== null && id !== undefined,
  );
}

export function deduplicatePairsByVehicle<T extends PairWithVehicleIds>(
  pairs: T[],
): { uniquePairs: T[]; seenVehicleIds: Set<number> } {
  const seenVehicleIds = new Set<number>();
  const uniquePairs: T[] = [];

  const sortedPairs = [...pairs].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  for (const pair of sortedPairs) {
    const vehicleIds = getVehicleIdsFromPair(pair);
    const hasDuplicate = vehicleIds.some((id) => seenVehicleIds.has(id));
    if (!hasDuplicate) {
      vehicleIds.forEach((id) => seenVehicleIds.add(id));
      uniquePairs.push(pair);
    }
  }

  return { uniquePairs, seenVehicleIds };
}

export function calculateAverageWeightDiff(pairs: PairWithVehicleIds[]): {
  avgWeightDiffKg: number;
  avgWeightGainPct: number;
  avgNormalizedDiff: number | null;
} {
  const totalPairs = pairs.length;

  if (totalPairs === 0) {
    return {
      avgWeightDiffKg: 0,
      avgWeightGainPct: 0,
      avgNormalizedDiff: null,
    };
  }

  const totalWeightDiff = pairs.reduce((sum, p) => sum + (p.weightDiffKg || 0), 0);
  const avgWeightDiffKg = totalWeightDiff / totalPairs;

  const totalWeightGainPct = pairs.reduce((sum, p) => sum + (p.weightGainPct || 0), 0);
  const avgWeightGainPct = totalWeightGainPct / totalPairs;

  const validNormalizedPairs = pairs.filter(
    (p) => p.normalizedDiff !== null && p.normalizedDiff !== undefined,
  );
  const avgNormalizedDiff =
    validNormalizedPairs.length > 0
      ? validNormalizedPairs.reduce((sum, p) => sum + (p.normalizedDiff as number), 0) /
        validNormalizedPairs.length
      : null;

  return {
    avgWeightDiffKg,
    avgWeightGainPct,
    avgNormalizedDiff,
  };
}

export function roundMetrics(metrics: {
  avgWeightDiffKg: number;
  avgWeightGainPct: number;
  avgNormalizedDiff: number | null;
}): {
  avgWeightDiffKg: number;
  avgWeightGainPct: number;
  avgNormalizedDiff: number | null;
} {
  return {
    avgWeightDiffKg: Math.round(metrics.avgWeightDiffKg * 10) / 10,
    avgWeightGainPct: Math.round(metrics.avgWeightGainPct * 100) / 100,
    avgNormalizedDiff:
      metrics.avgNormalizedDiff !== null ? Math.round(metrics.avgNormalizedDiff * 100) / 100 : null,
  };
}

export function isExtremeGain(weightGainPct: number, weightDiffKg: number): boolean {
  return weightGainPct > 35 || weightDiffKg > 500;
}

export function getBatteryCorrelation(
  batteryKwh: number | null | undefined,
  weightDiffKg: number,
): 'high' | 'medium' | 'low' {
  if (batteryKwh && batteryKwh >= 85) {
    return weightDiffKg > 400 ? 'high' : 'medium';
  } else if (batteryKwh && batteryKwh >= 60) {
    return weightDiffKg > 300 ? 'medium' : 'low';
  }
  return 'low';
}

export function isBatteryRelated(batteryKwh: number | null | undefined): boolean {
  return (batteryKwh || 0) >= 85;
}

export interface ClassStatistics {
  vehicleClass: string;
  totalPairs: number;
  uniqueVehicleCount: number;
  avgWeightDiffKg: number;
  avgWeightGainPct: number;
  avgNormalizedDiff: number | null;
}

export function calculateClassStatistics(pairs: PairWithVehicleIds[]): ClassStatistics[] {
  const grouped: Record<string, PairWithVehicleIds[]> = {};

  pairs.forEach((pair) => {
    if (!grouped[pair.vehicleClass]) {
      grouped[pair.vehicleClass] = [];
    }
    grouped[pair.vehicleClass].push(pair);
  });

  return Object.entries(grouped).map(([vehicleClass, classPairs]) => {
    const { uniquePairs, seenVehicleIds } = deduplicatePairsByVehicle(classPairs);

    const averages = calculateAverageWeightDiff(uniquePairs);
    const roundedAverages = roundMetrics(averages);

    return {
      vehicleClass,
      totalPairs: uniquePairs.length,
      uniqueVehicleCount: seenVehicleIds.size,
      ...roundedAverages,
    };
  });
}

export interface OverallStatistics {
  totalPairs: number;
  uniqueVehicleCount: number;
  avgWeightDiffKg: number;
  avgWeightGainPct: number;
  avgNormalizedDiff: number | null;
  extremeCount: number;
}

export function calculateOverallStatistics(pairs: PairWithVehicleIds[]): OverallStatistics {
  const { uniquePairs, seenVehicleIds } = deduplicatePairsByVehicle(pairs);

  const averages = calculateAverageWeightDiff(uniquePairs);
  const roundedAverages = roundMetrics(averages);

  const extremeCount = uniquePairs.filter((p) =>
    isExtremeGain(p.weightGainPct || 0, p.weightDiffKg || 0),
  ).length;

  return {
    totalPairs: uniquePairs.length,
    uniqueVehicleCount: seenVehicleIds.size,
    ...roundedAverages,
    extremeCount,
  };
}

export interface CauseStatistics {
  cause: string;
  count: number;
  avgWeightDiffKg: number;
  avgWeightGainPct: number;
  percentage: number;
}

export function calculateCauseStatistics(pairs: PairWithVehicleIds[]): CauseStatistics[] {
  const { uniquePairs } = deduplicatePairsByVehicle(pairs);
  const totalPairs = uniquePairs.length;

  const grouped: Record<string, { count: number; totalDiff: number; totalGain: number }> = {};

  uniquePairs.forEach((pair) => {
    const cause = pair.primaryCause || 'UNKNOWN';
    if (!grouped[cause]) {
      grouped[cause] = { count: 0, totalDiff: 0, totalGain: 0 };
    }
    grouped[cause].count++;
    grouped[cause].totalDiff += pair.weightDiffKg || 0;
    grouped[cause].totalGain += pair.weightGainPct || 0;
  });

  return Object.entries(grouped).map(([cause, data]) => ({
    cause,
    count: data.count,
    avgWeightDiffKg: Math.round((data.totalDiff / data.count) * 10) / 10,
    avgWeightGainPct: Math.round((data.totalGain / data.count) * 100) / 100,
    percentage: Math.round((data.count / totalPairs) * 100),
  }));
}

export interface PairTypeStatistics {
  pairType: string;
  count: number;
  avgWeightDiffKg: number;
  avgWeightGainPct: number;
}

export function calculatePairTypeStatistics(
  pairs: (PairWithVehicleIds & { pairType: string | null })[],
): PairTypeStatistics[] {
  const { uniquePairs } = deduplicatePairsByVehicle(pairs);

  const grouped: Record<string, { count: number; totalDiff: number; totalGain: number }> = {};

  uniquePairs.forEach((pair) => {
    const type = pair.pairType || 'UNKNOWN';
    if (!grouped[type]) {
      grouped[type] = { count: 0, totalDiff: 0, totalGain: 0 };
    }
    grouped[type].count++;
    grouped[type].totalDiff += pair.weightDiffKg || 0;
    grouped[type].totalGain += pair.weightGainPct || 0;
  });

  return Object.entries(grouped).map(([type, data]) => ({
    pairType: type,
    count: data.count,
    avgWeightDiffKg: Math.round((data.totalDiff / data.count) * 10) / 10,
    avgWeightGainPct: Math.round((data.totalGain / data.count) * 100) / 100,
  }));
}

export interface ExtremePair {
  id: number;
  modelName: string;
  brand: string;
  vehicleClass: string;
  pairType: string;
  weightDiffKg: number;
  weightGainPct: number;
  normalizedDiff: number | null;
  batteryKwh: number | null;
  isBatteryRelated: boolean;
  batteryCorrelation: string;
  primaryCause: string | null;
  causeTags: string[];
  notes: string | null;
}

export function formatExtremePair(
  pair: PairWithVehicleIds & {
    modelName: string;
    brand: string;
    vehicleClass: string;
    pairType: string;
    evVehicle?: { batteryKwh: number | null } | null;
  },
): ExtremePair {
  const batteryKwh = pair.evVehicle?.batteryKwh || null;
  const weightDiffKg = pair.weightDiffKg || 0;

  return {
    id: pair.id,
    modelName: pair.modelName,
    brand: pair.brand,
    vehicleClass: pair.vehicleClass,
    pairType: pair.pairType,
    weightDiffKg,
    weightGainPct: pair.weightGainPct || 0,
    normalizedDiff:
      pair.normalizedDiff !== null && pair.normalizedDiff !== undefined
        ? pair.normalizedDiff
        : null,
    batteryKwh,
    isBatteryRelated: isBatteryRelated(batteryKwh),
    batteryCorrelation: getBatteryCorrelation(batteryKwh, weightDiffKg),
    primaryCause: pair.primaryCause,
    causeTags: parseCauseTags(pair.causeTags),
    notes: pair.notes,
  };
}

export function calculateBatteryCorrelationGroups(
  pairs: (PairWithVehicleIds & {
    evVehicle?: { batteryKwh: number | null } | null;
  })[],
) {
  const { uniquePairs } = deduplicatePairsByVehicle(pairs);
  const pairsToUse = uniquePairs;

  const withLargeBattery = pairsToUse.filter((p) => (p.evVehicle?.batteryKwh || 0) >= 85);
  const withMediumBattery = pairsToUse.filter(
    (p) => (p.evVehicle?.batteryKwh || 0) >= 60 && (p.evVehicle?.batteryKwh || 0) < 85,
  );
  const withSmallBattery = pairsToUse.filter((p) => (p.evVehicle?.batteryKwh || 0) < 60);

  const avgDiff = (data: PairWithVehicleIds[]) =>
    data.length > 0 ? data.reduce((sum, p) => sum + (p.weightDiffKg || 0), 0) / data.length : 0;
  const avgGain = (data: PairWithVehicleIds[]) =>
    data.length > 0 ? data.reduce((sum, p) => sum + (p.weightGainPct || 0), 0) / data.length : 0;

  return {
    largeBattery: {
      count: withLargeBattery.length,
      avgWeightDiffKg: Math.round(avgDiff(withLargeBattery) * 10) / 10,
      avgWeightGainPct: Math.round(avgGain(withLargeBattery) * 100) / 100,
    },
    mediumBattery: {
      count: withMediumBattery.length,
      avgWeightDiffKg: Math.round(avgDiff(withMediumBattery) * 10) / 10,
      avgWeightGainPct: Math.round(avgGain(withMediumBattery) * 100) / 100,
    },
    smallBattery: {
      count: withSmallBattery.length,
      avgWeightDiffKg: Math.round(avgDiff(withSmallBattery) * 10) / 10,
      avgWeightGainPct: Math.round(avgGain(withSmallBattery) * 100) / 100,
    },
  };
}
