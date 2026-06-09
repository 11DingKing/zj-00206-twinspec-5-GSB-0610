import type { Vehicle } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PowerType, PairStatus, PairType } from '../types';
import {
  analyzeWeightDifference,
  analyzeWeightGainCause,
  formatCauseTags,
} from '../utils/weightCalculator';
import {
  validatePairCreation,
  validateSameClass,
  getPairedVehicleIds,
  buildPairingCandidateWhereClause,
} from '../utils/pairValidator';
import { findAvailableVehicles, findPairByIdWithVehicles } from '../repositories/pairRepository';

const prisma = new PrismaClient();

export interface PairingCandidate {
  baseVehicle: Vehicle;
  targetVehicle: Vehicle;
  pairType: string;
  matchScore: number;
  matchReasons: string[];
}

export function calculateMatchScore(
  base: Vehicle,
  target: Vehicle,
  _pairType: string,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (base.platform === target.platform) {
    score += 40;
    reasons.push('同平台');
  }
  if (base.vehicleClass === target.vehicleClass) {
    score += 30;
    reasons.push('同级别');
  }
  if (base.brand === target.brand) {
    score += 15;
    reasons.push('同品牌');
  }
  if (base.modelSeries && target.modelSeries && base.modelSeries === target.modelSeries) {
    score += 25;
    reasons.push('同系列');
  }
  if (Math.abs(base.year - target.year) <= 1) {
    score += 5;
    reasons.push('同年款');
  }

  const lengthDiff = Math.abs(base.lengthMm - target.lengthMm);
  if (lengthDiff <= 30) {
    score += 15;
    reasons.push(`车长接近(差${lengthDiff}mm)`);
  } else if (lengthDiff <= 70) {
    score += 8;
    reasons.push(`车长较近(差${lengthDiff}mm)`);
  } else if (lengthDiff <= 120) {
    score += 3;
  }

  const wheelbaseDiff = Math.abs(base.wheelbaseMm - target.wheelbaseMm);
  if (wheelbaseDiff <= 20) {
    score += 15;
    reasons.push(`轴距接近(差${wheelbaseDiff}mm)`);
  } else if (wheelbaseDiff <= 50) {
    score += 8;
    reasons.push(`轴距较近(差${wheelbaseDiff}mm)`);
  } else if (wheelbaseDiff <= 100) {
    score += 3;
  }

  const widthDiff = Math.abs(base.widthMm - target.widthMm);
  if (widthDiff <= 20) {
    score += 10;
    reasons.push(`车宽接近(差${widthDiff}mm)`);
  } else if (widthDiff <= 50) {
    score += 5;
  }

  const heightDiff = Math.abs(base.heightMm - target.heightMm);
  if (heightDiff <= 20) {
    score += 5;
    reasons.push(`车高接近(差${heightDiff}mm)`);
  }

  if (base.trimLevel === target.trimLevel) {
    score += 10;
    reasons.push('同配置级别');
  }

  return { score, reasons };
}

export function findSmartPairingCandidates(
  vehicles: Vehicle[],
  minScore: number = 65,
): PairingCandidate[] {
  const candidates: PairingCandidate[] = [];

  const pairTypes = [
    { base: PowerType.ICE, target: PowerType.EV, type: PairType.ICE_EV },
    { base: PowerType.ICE, target: PowerType.PHEV, type: PairType.ICE_PHEV },
    { base: PowerType.PHEV, target: PowerType.EV, type: PairType.PHEV_EV },
  ];

  for (const pt of pairTypes) {
    const baseVehicles = vehicles.filter((v) => v.powerType === pt.base);
    const targetVehicles = vehicles.filter((v) => v.powerType === pt.target);

    for (const base of baseVehicles) {
      for (const target of targetVehicles) {
        const classValidation = validateSameClass(base, target);
        if (!classValidation.valid) continue;
        if (base.platform !== target.platform) continue;

        const { score, reasons } = calculateMatchScore(base, target, pt.type);
        if (score >= minScore) {
          candidates.push({
            baseVehicle: base,
            targetVehicle: target,
            pairType: pt.type,
            matchScore: score,
            matchReasons: reasons,
          });
        }
      }
    }
  }

  return candidates.sort((a, b) => b.matchScore - a.matchScore);
}

export async function getSmartCandidates(
  vehicleId: number,
  minScore: number = 60,
): Promise<PairingCandidate[]> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
  });

  if (!vehicle) {
    throw new Error('Vehicle not found');
  }

  const pairedIds = await getPairedVehicleIds();

  let targetPowerTypes: string[] = [];
  if (vehicle.powerType === PowerType.ICE) {
    targetPowerTypes = [PowerType.PHEV, PowerType.EV];
  } else if (vehicle.powerType === PowerType.PHEV) {
    targetPowerTypes = [PowerType.EV];
  } else {
    targetPowerTypes = [PowerType.PHEV, PowerType.ICE];
  }

  const whereClause = buildPairingCandidateWhereClause(vehicle, pairedIds, targetPowerTypes);

  const candidates = await prisma.vehicle.findMany({
    where: whereClause,
  });

  const results: PairingCandidate[] = [];
  for (const target of candidates) {
    let pairType: string = PairType.ICE_EV;
    if (vehicle.powerType === PowerType.ICE && target.powerType === PowerType.PHEV) {
      pairType = PairType.ICE_PHEV;
    } else if (vehicle.powerType === PowerType.PHEV && target.powerType === PowerType.EV) {
      pairType = PairType.PHEV_EV;
    } else if (vehicle.powerType === PowerType.EV && target.powerType === PowerType.PHEV) {
      pairType = PairType.PHEV_EV;
    }

    const { score, reasons } = calculateMatchScore(vehicle, target, pairType);
    if (score >= minScore) {
      results.push({
        baseVehicle: vehicle,
        targetVehicle: target,
        pairType,
        matchScore: score,
        matchReasons: reasons,
      });
    }
  }

  return results.sort((a, b) => b.matchScore - a.matchScore);
}

export async function createPair(
  baseVehicleId: number,
  targetVehicleId: number,
  pairType: string = PairType.ICE_EV,
  status: PairStatus = PairStatus.PENDING,
) {
  const baseVehicle = await prisma.vehicle.findUnique({
    where: { id: baseVehicleId },
  });
  const targetVehicle = await prisma.vehicle.findUnique({
    where: { id: targetVehicleId },
  });

  if (!baseVehicle || !targetVehicle) {
    throw new Error('Vehicle not found');
  }

  const validation = await validatePairCreation(baseVehicle, targetVehicle);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const weightAnalysis = analyzeWeightDifference(baseVehicle, targetVehicle);
  const causeAnalysis = analyzeWeightGainCause(baseVehicle, targetVehicle);

  const { score } = calculateMatchScore(baseVehicle, targetVehicle, pairType);

  const pairData: any = {
    modelName: baseVehicle.modelName,
    brand: baseVehicle.brand,
    platform: baseVehicle.platform,
    vehicleClass: baseVehicle.vehicleClass,
    pairType,
    status,
    matchScore: score,
    weightDiffKg: weightAnalysis.weightDiffKg,
    weightGainPct: weightAnalysis.weightGainPct,
    normalizedDiff: weightAnalysis.normalizedDiff,
    sizeDiffMm: causeAnalysis.sizeDiffMm,
    batteryContributionKg: causeAnalysis.batteryContributionKg,
    sizeContributionKg: causeAnalysis.sizeContributionKg,
    featureContributionKg: causeAnalysis.featureContributionKg,
    primaryCause: causeAnalysis.primaryCause,
    causeTags: formatCauseTags(causeAnalysis.causeTags),
    notes: weightAnalysis.isExtremeGain
      ? `极端增重! 电池相关性: ${weightAnalysis.batteryCorrelation}, 主因: ${causeAnalysis.primaryCause}`
      : undefined,
  };

  if (pairType === PairType.ICE_EV) {
    pairData.iceVehicleId = baseVehicleId;
    pairData.evVehicleId = targetVehicleId;
  } else if (pairType === PairType.ICE_PHEV) {
    pairData.iceVehicleId = baseVehicleId;
    pairData.phevVehicleId = targetVehicleId;
  } else if (pairType === PairType.PHEV_EV) {
    pairData.phevVehicleId = baseVehicleId;
    pairData.evVehicleId = targetVehicleId;
  }

  const pair = await prisma.vehiclePair.create({
    data: pairData,
    include: {
      iceVehicle: true,
      phevVehicle: true,
      evVehicle: true,
    },
  });

  return {
    pair,
    weightAnalysis,
    causeAnalysis,
  };
}

export async function autoPairAllVehicles() {
  const vehicles = await findAvailableVehicles();

  const candidates = findSmartPairingCandidates(vehicles, 70);

  const usedBaseIds = new Set<number>();
  const usedTargetIds = new Set<number>();
  const results: any[] = [];

  for (const candidate of candidates) {
    if (usedBaseIds.has(candidate.baseVehicle.id)) continue;
    if (usedTargetIds.has(candidate.targetVehicle.id)) continue;

    try {
      const result = await createPair(
        candidate.baseVehicle.id,
        candidate.targetVehicle.id,
        candidate.pairType,
        PairStatus.PENDING,
      );
      usedBaseIds.add(candidate.baseVehicle.id);
      usedTargetIds.add(candidate.targetVehicle.id);
      results.push({
        ...result,
        matchScore: candidate.matchScore,
        matchReasons: candidate.matchReasons,
      });
    } catch (e) {
      console.error('Failed to pair:', e);
    }
  }

  return {
    totalPairs: results.length,
    pairs: results,
  };
}

export async function updatePairStatus(pairId: number, status: PairStatus) {
  return prisma.vehiclePair.update({
    where: { id: pairId },
    data: { status },
  });
}

export async function recalculatePairMetrics(pairId: number) {
  const pair = await findPairByIdWithVehicles(pairId);

  if (!pair) {
    throw new Error('Pair not found');
  }

  let baseVehicle: Vehicle | null = null;
  let targetVehicle: Vehicle | null = null;

  if (pair.pairType === PairType.ICE_EV) {
    baseVehicle = pair.iceVehicle;
    targetVehicle = pair.evVehicle;
  } else if (pair.pairType === PairType.ICE_PHEV) {
    baseVehicle = pair.iceVehicle;
    targetVehicle = pair.phevVehicle;
  } else if (pair.pairType === PairType.PHEV_EV) {
    baseVehicle = pair.phevVehicle;
    targetVehicle = pair.evVehicle;
  }

  if (!baseVehicle || !targetVehicle) {
    throw new Error('Pair vehicles not found');
  }

  const weightAnalysis = analyzeWeightDifference(baseVehicle, targetVehicle);
  const causeAnalysis = analyzeWeightGainCause(baseVehicle, targetVehicle);

  return prisma.vehiclePair.update({
    where: { id: pairId },
    data: {
      weightDiffKg: weightAnalysis.weightDiffKg,
      weightGainPct: weightAnalysis.weightGainPct,
      normalizedDiff: weightAnalysis.normalizedDiff,
      sizeDiffMm: causeAnalysis.sizeDiffMm,
      batteryContributionKg: causeAnalysis.batteryContributionKg,
      sizeContributionKg: causeAnalysis.sizeContributionKg,
      featureContributionKg: causeAnalysis.featureContributionKg,
      primaryCause: causeAnalysis.primaryCause,
      causeTags: formatCauseTags(causeAnalysis.causeTags),
      notes: weightAnalysis.isExtremeGain
        ? `极端增重! 电池相关性: ${weightAnalysis.batteryCorrelation}, 主因: ${causeAnalysis.primaryCause}`
        : null,
    },
  });
}

export async function batchConfirmPairs(pairIds: number[], status: PairStatus = PairStatus.PAIRED) {
  const results = [];
  for (const id of pairIds) {
    try {
      const pair = await updatePairStatus(id, status);
      results.push({ id, success: true, pair });
    } catch (e: any) {
      results.push({ id, success: false, error: e.message });
    }
  }
  return results;
}

export async function getCauseAnalysis(pairId: number) {
  const pair = await findPairByIdWithVehicles(pairId);

  if (!pair) {
    throw new Error('Pair not found');
  }

  let baseVehicle: Vehicle | null = null;
  let targetVehicle: Vehicle | null = null;

  if (pair.pairType === PairType.ICE_EV) {
    baseVehicle = pair.iceVehicle;
    targetVehicle = pair.evVehicle;
  } else if (pair.pairType === PairType.ICE_PHEV) {
    baseVehicle = pair.iceVehicle;
    targetVehicle = pair.phevVehicle;
  } else if (pair.pairType === PairType.PHEV_EV) {
    baseVehicle = pair.phevVehicle;
    targetVehicle = pair.evVehicle;
  }

  if (!baseVehicle || !targetVehicle) {
    throw new Error('Pair vehicles not found');
  }

  const causeAnalysis = analyzeWeightGainCause(baseVehicle, targetVehicle);

  return {
    pairId,
    baseVehicle,
    targetVehicle,
    weightDiffKg: pair.weightDiffKg,
    weightGainPct: pair.weightGainPct,
    ...causeAnalysis,
  };
}
