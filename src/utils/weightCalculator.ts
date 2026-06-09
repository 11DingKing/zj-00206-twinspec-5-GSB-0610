import type { Vehicle } from '@prisma/client';
export { ClassStatistics, calculateClassStatistics } from './pairMetrics';

const WEIGHT_GAIN_CAUSE = {
  BATTERY: 'BATTERY',
  SIZE: 'SIZE',
  FEATURES: 'FEATURES',
  MIXED: 'MIXED',
} as const;

type WeightGainCause = (typeof WEIGHT_GAIN_CAUSE)[keyof typeof WEIGHT_GAIN_CAUSE];

const CAUSE_TAG = {
  LARGE_BATTERY: 'LARGE_BATTERY',
  EXTENDED_WHEELBASE: 'EXTENDED_WHEELBASE',
  WIDER_BODY: 'WIDER_BODY',
  TALLER_BODY: 'TALLER_BODY',
  PREMIUM_TRIM: 'PREMIUM_TRIM',
  ADAS_FEATURES: 'ADAS_FEATURES',
  LUXURY_FEATURES: 'LUXURY_FEATURES',
  PERFORMANCE_UPGRADE: 'PERFORMANCE_UPGRADE',
} as const;

type CauseTag = (typeof CAUSE_TAG)[keyof typeof CAUSE_TAG];

export interface WeightAnalysis {
  weightDiffKg: number;
  weightGainPct: number;
  normalizedDiff: number | null;
  isExtremeGain: boolean;
  batteryCorrelation: 'high' | 'medium' | 'low';
}

export interface WeightGainCauseAnalysis {
  batteryContributionKg: number;
  sizeContributionKg: number;
  featureContributionKg: number;
  primaryCause: WeightGainCause;
  causeTags: CauseTag[];
  sizeDiffMm: number | null;
  breakdown: {
    battery: {
      percentage: number;
      amount: number;
    };
    size: {
      percentage: number;
      amount: number;
    };
    features: {
      percentage: number;
      amount: number;
    };
  };
}

export function calculateFootprint(lengthMm: number, widthMm: number): number {
  return (lengthMm / 1000) * (widthMm / 1000);
}

export function calculateVolume(lengthMm: number, widthMm: number, heightMm: number): number {
  return (lengthMm / 1000) * (widthMm / 1000) * (heightMm / 1000);
}

export function calculateWeightPerVolume(curbWeight: number, volume: number): number {
  return curbWeight / volume;
}

export function calculateNormalizedWeight(
  curbWeight: number | null | undefined,
  lengthMm: number | null | undefined,
  widthMm: number | null | undefined,
  heightMm: number | null | undefined,
): number | null {
  if (
    !curbWeight ||
    !lengthMm ||
    !widthMm ||
    !heightMm ||
    curbWeight <= 0 ||
    lengthMm <= 0 ||
    widthMm <= 0 ||
    heightMm <= 0
  ) {
    return null;
  }
  const volume = calculateVolume(lengthMm, widthMm, heightMm);
  if (volume <= 0) return null;
  return calculateWeightPerVolume(curbWeight, volume);
}

export function analyzeWeightDifference(iceVehicle: Vehicle, evVehicle: Vehicle): WeightAnalysis {
  const weightDiffKg = evVehicle.curbWeight - iceVehicle.curbWeight;
  const weightGainPct = (weightDiffKg / iceVehicle.curbWeight) * 100;

  const iceNormalized = calculateNormalizedWeight(
    iceVehicle.curbWeight,
    iceVehicle.lengthMm,
    iceVehicle.widthMm,
    iceVehicle.heightMm,
  );

  const evNormalized = calculateNormalizedWeight(
    evVehicle.curbWeight,
    evVehicle.lengthMm,
    evVehicle.widthMm,
    evVehicle.heightMm,
  );

  let normalizedDiff: number | null = null;
  if (iceNormalized !== null && evNormalized !== null) {
    normalizedDiff = Math.round((evNormalized - iceNormalized) * 100) / 100;
  }

  const isExtremeGain = weightGainPct > 35 || weightDiffKg > 500;

  let batteryCorrelation: 'high' | 'medium' | 'low' = 'low';
  if (evVehicle.batteryKwh && evVehicle.batteryKwh >= 85) {
    batteryCorrelation = weightDiffKg > 400 ? 'high' : 'medium';
  } else if (evVehicle.batteryKwh && evVehicle.batteryKwh >= 60) {
    batteryCorrelation = weightDiffKg > 300 ? 'medium' : 'low';
  }

  return {
    weightDiffKg,
    weightGainPct: Math.round(weightGainPct * 100) / 100,
    normalizedDiff,
    isExtremeGain,
    batteryCorrelation,
  };
}

const BATTERY_WEIGHT_PER_KWH = 12;
const STEEL_DENSITY = 7.85;
const FEATURE_WEIGHT_PER_FEATURE = 15;

export function calculateBatteryWeight(batteryKwh: number | null | undefined): number {
  if (!batteryKwh) return 0;
  return batteryKwh * BATTERY_WEIGHT_PER_KWH;
}

export function calculateSizeDifference(
  base: Vehicle,
  target: Vehicle,
): {
  sizeDiffMm: number | null;
  wheelbaseDiff: number | null;
  lengthDiff: number | null;
  widthDiff: number | null;
  heightDiff: number | null;
  volumeDiff: number | null;
} {
  const hasAllDimensions =
    base.lengthMm &&
    base.widthMm &&
    base.heightMm &&
    target.lengthMm &&
    target.widthMm &&
    target.heightMm;

  if (!hasAllDimensions) {
    return {
      sizeDiffMm: null,
      wheelbaseDiff: null,
      lengthDiff: null,
      widthDiff: null,
      heightDiff: null,
      volumeDiff: null,
    };
  }

  const lengthDiff = target.lengthMm - base.lengthMm;
  const widthDiff = target.widthMm - base.widthMm;
  const heightDiff = target.heightMm - base.heightMm;
  const wheelbaseDiff =
    target.wheelbaseMm && base.wheelbaseMm ? target.wheelbaseMm - base.wheelbaseMm : null;

  const baseVolume = calculateVolume(base.lengthMm, base.widthMm, base.heightMm);
  const targetVolume = calculateVolume(target.lengthMm, target.widthMm, target.heightMm);
  const volumeDiff = targetVolume - baseVolume;

  const sizeDiffMm = Math.abs(lengthDiff) + Math.abs(widthDiff) + Math.abs(heightDiff);

  return {
    sizeDiffMm,
    wheelbaseDiff,
    lengthDiff,
    widthDiff,
    heightDiff,
    volumeDiff,
  };
}

export function estimateSizeWeightContribution(volumeDiff: number | null): number {
  if (!volumeDiff || volumeDiff <= 0) return 0;
  const estimatedMetalVolume = volumeDiff * 0.08;
  return Math.round(estimatedMetalVolume * 1000 * STEEL_DENSITY);
}

export function estimateFeatureWeightContribution(
  baseFeatureCount: number | null | undefined,
  targetFeatureCount: number | null | undefined,
  baseTrim: string,
  targetTrim: string,
): number {
  let weight = 0;

  const featureDiff = (targetFeatureCount || 0) - (baseFeatureCount || 0);
  if (featureDiff > 0) {
    weight += featureDiff * FEATURE_WEIGHT_PER_FEATURE;
  }

  const trimHierarchy = ['BASE', 'MID', 'HIGH', 'PREMIUM'];
  const baseTrimIndex = trimHierarchy.indexOf(baseTrim);
  const targetTrimIndex = trimHierarchy.indexOf(targetTrim);
  const trimUpgradeLevels = targetTrimIndex - baseTrimIndex;

  if (trimUpgradeLevels > 0) {
    weight += trimUpgradeLevels * 40;
  }

  return Math.round(weight);
}

export function analyzeWeightGainCause(
  baseVehicle: Vehicle,
  targetVehicle: Vehicle,
): WeightGainCauseAnalysis {
  const totalDiff = targetVehicle.curbWeight - baseVehicle.curbWeight;
  const absoluteDiff = Math.abs(totalDiff);

  const batteryWeight =
    calculateBatteryWeight(targetVehicle.batteryKwh) -
    calculateBatteryWeight(baseVehicle.batteryKwh);

  const sizeAnalysis = calculateSizeDifference(baseVehicle, targetVehicle);
  const sizeWeight = estimateSizeWeightContribution(sizeAnalysis.volumeDiff);

  const featureWeight = estimateFeatureWeightContribution(
    baseVehicle.featureCount,
    targetVehicle.featureCount,
    baseVehicle.trimLevel,
    targetVehicle.trimLevel,
  );

  let batteryContribution = batteryWeight;
  let sizeContribution = sizeWeight;
  let featureContribution = featureWeight;

  const sumOfComponents = batteryContribution + sizeContribution + featureContribution;

  if (absoluteDiff > 0 && sumOfComponents > 0) {
    const ratio = absoluteDiff / sumOfComponents;
    batteryContribution = Math.round(batteryContribution * ratio);
    sizeContribution = Math.round(sizeContribution * ratio);
    featureContribution = Math.round(featureContribution * ratio);
  }

  const batteryPct = absoluteDiff > 0 ? Math.round((batteryContribution / absoluteDiff) * 100) : 0;
  const sizePct = absoluteDiff > 0 ? Math.round((sizeContribution / absoluteDiff) * 100) : 0;
  const featurePct = 100 - batteryPct - sizePct;

  const causeTags: CauseTag[] = [];

  if ((targetVehicle.batteryKwh || 0) >= 85) {
    causeTags.push(CAUSE_TAG.LARGE_BATTERY);
  }
  if ((targetVehicle.batteryKwh || 0) >= 60 && batteryPct >= 40) {
    causeTags.push(CAUSE_TAG.PERFORMANCE_UPGRADE);
  }
  if (sizeAnalysis.wheelbaseDiff !== null && sizeAnalysis.wheelbaseDiff >= 50) {
    causeTags.push(CAUSE_TAG.EXTENDED_WHEELBASE);
  }
  if (sizeAnalysis.widthDiff !== null && sizeAnalysis.widthDiff >= 30) {
    causeTags.push(CAUSE_TAG.WIDER_BODY);
  }
  if (sizeAnalysis.heightDiff !== null && sizeAnalysis.heightDiff >= 20) {
    causeTags.push(CAUSE_TAG.TALLER_BODY);
  }
  if (targetVehicle.trimLevel === 'PREMIUM' && baseVehicle.trimLevel !== 'PREMIUM') {
    causeTags.push(CAUSE_TAG.PREMIUM_TRIM);
  }
  if (featurePct >= 30) {
    causeTags.push(CAUSE_TAG.LUXURY_FEATURES);
  }
  if ((targetVehicle.featureCount || 0) - (baseVehicle.featureCount || 0) >= 8) {
    causeTags.push(CAUSE_TAG.ADAS_FEATURES);
  }

  let primaryCause: WeightGainCause;
  if (batteryPct >= 50) {
    primaryCause = WEIGHT_GAIN_CAUSE.BATTERY;
  } else if (sizePct >= 50) {
    primaryCause = WEIGHT_GAIN_CAUSE.SIZE;
  } else if (featurePct >= 50) {
    primaryCause = WEIGHT_GAIN_CAUSE.FEATURES;
  } else {
    primaryCause = WEIGHT_GAIN_CAUSE.MIXED;
  }

  return {
    batteryContributionKg: batteryContribution,
    sizeContributionKg: sizeContribution,
    featureContributionKg: featureContribution,
    primaryCause,
    causeTags,
    sizeDiffMm: sizeAnalysis.sizeDiffMm,
    breakdown: {
      battery: {
        percentage: batteryPct,
        amount: batteryContribution,
      },
      size: {
        percentage: sizePct,
        amount: sizeContribution,
      },
      features: {
        percentage: featurePct,
        amount: featureContribution,
      },
    },
  };
}

export function formatCauseTags(causeTags: CauseTag[]): string {
  return causeTags.join(',');
}

export function parseCauseTags(causeTagsStr: string | null): CauseTag[] {
  if (!causeTagsStr) return [];
  return causeTagsStr.split(',') as CauseTag[];
}
