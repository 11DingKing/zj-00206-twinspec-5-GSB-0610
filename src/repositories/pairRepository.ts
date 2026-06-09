import type { VehiclePair } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import type { VehicleClass } from '../types';
import { PairStatus } from '../types';
import { getPairedVehicleIds } from '../utils/pairValidator';

const prisma = new PrismaClient();

const PAIRED_SELECT_FIELDS = {
  id: true,
  iceVehicleId: true,
  phevVehicleId: true,
  evVehicleId: true,
  matchScore: true,
  primaryCause: true,
  weightDiffKg: true,
  weightGainPct: true,
  causeTags: true,
} as const;

const PAIRED_SELECT_FIELDS_WITH_PAIRTYPE = {
  ...PAIRED_SELECT_FIELDS,
  pairType: true,
} as const;

export async function findPairedPairs(includeVehicles: boolean = false): Promise<VehiclePair[]> {
  return prisma.vehiclePair.findMany({
    where: { status: PairStatus.PAIRED },
    include: includeVehicles
      ? {
          iceVehicle: true,
          phevVehicle: true,
          evVehicle: true,
        }
      : undefined,
  });
}

export async function findPairedPairsWithEvBattery(): Promise<any[]> {
  return prisma.vehiclePair.findMany({
    where: {
      status: PairStatus.PAIRED,
    },
    include: {
      evVehicle: {
        select: {
          batteryKwh: true,
        },
      },
    },
  });
}

export async function findPairedPairsWithFullEv(): Promise<any[]> {
  return prisma.vehiclePair.findMany({
    where: {
      status: PairStatus.PAIRED,
    },
    include: {
      evVehicle: true,
    },
  });
}

export async function findPairedPairsSelect<T extends object>(
  select: T,
): Promise<(VehiclePair & any)[]> {
  return prisma.vehiclePair.findMany({
    where: { status: PairStatus.PAIRED },
    select,
  });
}

export async function findPairedPairsForCauseStats() {
  return findPairedPairsSelect(PAIRED_SELECT_FIELDS);
}

export async function findPairedPairsForPairTypeStats() {
  return findPairedPairsSelect(PAIRED_SELECT_FIELDS_WITH_PAIRTYPE);
}

export async function findExtremeWeightGainPairs(limit: number = 10) {
  return prisma.vehiclePair.findMany({
    where: {
      status: PairStatus.PAIRED,
      weightGainPct: {
        not: null,
      },
    },
    include: {
      evVehicle: {
        select: {
          batteryKwh: true,
        },
      },
    },
    orderBy: [
      {
        weightGainPct: 'desc',
      },
    ],
    take: limit,
  });
}

export async function findPairsByClass(
  vehicleClass?: VehicleClass,
  includeVehicles: boolean = true,
) {
  const where = vehicleClass
    ? { vehicleClass, status: PairStatus.PAIRED }
    : { status: PairStatus.PAIRED };

  return prisma.vehiclePair.findMany({
    where,
    include: includeVehicles
      ? {
          iceVehicle: true,
          phevVehicle: true,
          evVehicle: true,
        }
      : undefined,
    orderBy: {
      weightGainPct: 'desc',
    },
  });
}

export async function countPairsByStatus(status: PairStatus): Promise<number> {
  return prisma.vehiclePair.count({ where: { status } });
}

export async function countVehiclesByPowerType(powerType?: string): Promise<number> {
  const where = powerType ? { powerType } : undefined;
  return prisma.vehicle.count({ where });
}

export async function findPairByIdWithVehicles(pairId: number) {
  return prisma.vehiclePair.findUnique({
    where: { id: pairId },
    include: {
      iceVehicle: true,
      phevVehicle: true,
      evVehicle: true,
    },
  });
}

export async function findAvailableVehicles() {
  const pairedIds = await getPairedVehicleIds();

  return prisma.vehicle.findMany({
    where: {
      id: { notIn: Array.from(pairedIds) },
    },
  });
}

export async function findAllPairVehicleIds() {
  return getPairedVehicleIds();
}
