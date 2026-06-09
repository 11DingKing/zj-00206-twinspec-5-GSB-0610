import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PairVehicleInfo {
  id: number;
  platform: string;
  vehicleClass: string;
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSamePlatformAndClass(
  baseVehicle: PairVehicleInfo,
  targetVehicle: PairVehicleInfo,
): ValidationResult {
  if (baseVehicle.vehicleClass !== targetVehicle.vehicleClass) {
    return {
      valid: false,
      error: 'Vehicles must be same class',
    };
  }

  if (baseVehicle.platform !== targetVehicle.platform) {
    return {
      valid: false,
      error: 'Vehicles must be same platform',
    };
  }

  return { valid: true };
}

export function validateSameClass(
  baseVehicle: PairVehicleInfo,
  targetVehicle: PairVehicleInfo,
): ValidationResult {
  if (baseVehicle.vehicleClass !== targetVehicle.vehicleClass) {
    return {
      valid: false,
      error: 'Vehicles must be same class',
    };
  }

  return { valid: true };
}

export async function getPairedVehicleIds(excludePairId?: number): Promise<Set<number>> {
  const allPairs = await prisma.vehiclePair.findMany({
    select: { id: true, iceVehicleId: true, phevVehicleId: true, evVehicleId: true },
  });

  const pairedIds = new Set<number>();
  allPairs.forEach((p) => {
    if (excludePairId !== undefined && p.id === excludePairId) return;
    if (p.iceVehicleId) pairedIds.add(p.iceVehicleId);
    if (p.phevVehicleId) pairedIds.add(p.phevVehicleId);
    if (p.evVehicleId) pairedIds.add(p.evVehicleId);
  });

  return pairedIds;
}

export async function validateNoDuplicatePairing(
  baseVehicleId: number,
  targetVehicleId: number,
  excludePairId?: number,
): Promise<ValidationResult> {
  const pairedIds = await getPairedVehicleIds(excludePairId);

  if (pairedIds.has(baseVehicleId)) {
    return {
      valid: false,
      error: `Base vehicle ${baseVehicleId} is already in another pair`,
    };
  }

  if (pairedIds.has(targetVehicleId)) {
    return {
      valid: false,
      error: `Target vehicle ${targetVehicleId} is already in another pair`,
    };
  }

  return { valid: true };
}

export async function validatePairCreation(
  baseVehicle: PairVehicleInfo,
  targetVehicle: PairVehicleInfo,
  requireSamePlatform: boolean = true,
): Promise<ValidationResult> {
  const platformValidation = requireSamePlatform
    ? validateSamePlatformAndClass(baseVehicle, targetVehicle)
    : validateSameClass(baseVehicle, targetVehicle);

  if (!platformValidation.valid) {
    return platformValidation;
  }

  const duplicateValidation = await validateNoDuplicatePairing(baseVehicle.id, targetVehicle.id);

  if (!duplicateValidation.valid) {
    return duplicateValidation;
  }

  return { valid: true };
}

export function buildPairingCandidateWhereClause(
  vehicle: PairVehicleInfo,
  pairedIds: Set<number>,
  targetPowerTypes: string[],
) {
  return {
    powerType: { in: targetPowerTypes },
    vehicleClass: vehicle.vehicleClass,
    platform: vehicle.platform,
    id: { notIn: Array.from(pairedIds) },
  };
}
