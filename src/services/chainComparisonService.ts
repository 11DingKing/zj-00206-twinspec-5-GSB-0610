import type { Vehicle } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PowerType, ChainStatus, PairType } from '../types';
import { analyzeWeightGainCause } from '../utils/weightCalculator';
import { calculateMatchScore } from './pairingService';

const prisma = new PrismaClient();

export interface ChainCandidate {
  modelSeries: string;
  brand: string;
  platform: string;
  vehicleClass: string;
  iceVehicle?: Vehicle;
  phevVehicle?: Vehicle;
  evVehicle?: Vehicle;
  powerTypes: string[];
  matchScore: number;
}

export interface ChainComparisonDetail {
  id: number;
  modelSeries: string;
  brand: string;
  platform: string;
  vehicleClass: string;
  status: string;
  items: {
    id: number;
    vehicleId: number;
    powerType: string;
    modelName: string;
    curbWeight: number;
    weightFromPrevious: number | null;
    weightFromBase: number | null;
    batteryKwh: number | null;
    sequence: number;
    primaryCause?: string;
    causeTags?: string[];
    breakdown?: any;
  }[];
  summary: {
    totalWeightGain: number;
    totalWeightGainPct: number;
    iceToPhevGain: number | null;
    phevToEvGain: number | null;
    iceToEvGain: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export function findChainCandidates(vehicles: Vehicle[]): ChainCandidate[] {
  const grouped: Record<string, Vehicle[]> = {};

  vehicles.forEach((v) => {
    const key = v.modelSeries
      ? `${v.brand}-${v.modelSeries}-${v.platform}-${v.vehicleClass}`
      : `${v.brand}-${v.modelName.replace(/\s+(EV|PHEV|DM|e-tron|iX|bZ|ID\.|Granvia|D9|L7|ES6|Model\s+\d+|009).*$/i, '')}-${v.platform}-${v.vehicleClass}`;

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(v);
  });

  const candidates: ChainCandidate[] = [];

  for (const [, group] of Object.entries(grouped)) {
    const iceVehicle = group.find((v) => v.powerType === PowerType.ICE);
    const phevVehicle = group.find((v) => v.powerType === PowerType.PHEV);
    const evVehicle = group.find((v) => v.powerType === PowerType.EV);

    const powerTypes = group.map((v) => v.powerType);
    const hasAtLeastTwo = powerTypes.length >= 2;

    if (hasAtLeastTwo) {
      let totalScore = 0;
      let pairCount = 0;

      if (iceVehicle && phevVehicle) {
        const { score } = calculateMatchScore(iceVehicle, phevVehicle, PairType.ICE_PHEV);
        totalScore += score;
        pairCount++;
      }
      if (phevVehicle && evVehicle) {
        const { score } = calculateMatchScore(phevVehicle, evVehicle, PairType.PHEV_EV);
        totalScore += score;
        pairCount++;
      }
      if (iceVehicle && evVehicle) {
        const { score } = calculateMatchScore(iceVehicle, evVehicle, PairType.ICE_EV);
        totalScore += score;
        pairCount++;
      }

      const avgScore = pairCount > 0 ? Math.round(totalScore / pairCount) : 0;

      const modelSeries =
        group[0].modelSeries ||
        group[0].modelName
          .replace(/\s+(EV|PHEV|DM|e-tron|iX|bZ|ID\.|Granvia|D9|L7|ES6|Model\s+\d+|009).*$/i, '')
          .trim();

      candidates.push({
        modelSeries,
        brand: group[0].brand,
        platform: group[0].platform,
        vehicleClass: group[0].vehicleClass,
        iceVehicle,
        phevVehicle,
        evVehicle,
        powerTypes,
        matchScore: avgScore,
      });
    }
  }

  return candidates.sort((a, b) => b.matchScore - a.matchScore);
}

export async function getChainCandidates() {
  const allChains = await prisma.chainComparison.findMany({
    include: { items: true },
  });

  const usedVehicleIds = new Set<number>();
  allChains.forEach((chain) => {
    chain.items.forEach((item) => usedVehicleIds.add(item.vehicleId));
  });

  const vehicles = await prisma.vehicle.findMany({
    where: {
      id: { notIn: Array.from(usedVehicleIds) },
    },
  });

  return findChainCandidates(vehicles);
}

export async function createChainComparison(
  modelSeries: string,
  vehicleIds: number[],
  status: string = ChainStatus.ACTIVE,
): Promise<ChainComparisonDetail> {
  const vehicles = await prisma.vehicle.findMany({
    where: { id: { in: vehicleIds } },
  });

  if (vehicles.length < 2) {
    throw new Error('At least 2 vehicles are required for chain comparison');
  }

  const powerOrder = [PowerType.ICE, PowerType.PHEV, PowerType.EV];
  const sortedVehicles = vehicles.sort((a, b) => {
    return powerOrder.indexOf(a.powerType as any) - powerOrder.indexOf(b.powerType as any);
  });

  const baseVehicle = sortedVehicles[0];
  const existingChain = await prisma.chainComparison.findFirst({
    where: {
      modelSeries,
      brand: baseVehicle.brand,
      platform: baseVehicle.platform,
      vehicleClass: baseVehicle.vehicleClass,
    },
  });

  if (existingChain) {
    throw new Error('Chain comparison already exists for this model series');
  }

  const chain = await prisma.chainComparison.create({
    data: {
      modelSeries,
      brand: baseVehicle.brand,
      platform: baseVehicle.platform,
      vehicleClass: baseVehicle.vehicleClass,
      status,
      items: {
        create: sortedVehicles.map((vehicle, index) => {
          const weightFromBase =
            index > 0 ? vehicle.curbWeight - sortedVehicles[0].curbWeight : null;
          const weightFromPrevious =
            index > 0 ? vehicle.curbWeight - sortedVehicles[index - 1].curbWeight : null;

          return {
            vehicleId: vehicle.id,
            powerType: vehicle.powerType,
            curbWeight: vehicle.curbWeight,
            weightFromPrevious,
            weightFromBase,
            batteryKwh: vehicle.batteryKwh,
            sequence: index,
          };
        }),
      },
    },
    include: {
      items: {
        include: {
          vehicle: true,
        },
      },
    },
  });

  return enrichChainWithAnalysis(chain);
}

export async function createChainFromVehicles(
  iceVehicleId?: number,
  phevVehicleId?: number,
  evVehicleId?: number,
): Promise<ChainComparisonDetail> {
  const vehicleIds: number[] = [];
  if (iceVehicleId) vehicleIds.push(iceVehicleId);
  if (phevVehicleId) vehicleIds.push(phevVehicleId);
  if (evVehicleId) vehicleIds.push(evVehicleId);

  const vehicles = await prisma.vehicle.findMany({
    where: { id: { in: vehicleIds } },
  });

  if (vehicles.length < 2) {
    throw new Error('At least 2 vehicles are required');
  }

  const ice = vehicles.find((v) => v.powerType === PowerType.ICE);
  const phev = vehicles.find((v) => v.powerType === PowerType.PHEV);
  const ev = vehicles.find((v) => v.powerType === PowerType.EV);

  const modelSeries =
    (ice || phev || ev)?.modelSeries ||
    (ice?.modelName || phev?.modelName || ev?.modelName || '')
      .replace(/\s+(EV|PHEV|DM|e-tron|iX|bZ|ID\.|Granvia|D9|L7|ES6|Model\s+\d+|009).*$/i, '')
      .trim();

  return createChainComparison(modelSeries, vehicleIds);
}

export async function autoCreateChains() {
  const candidates = await getChainCandidates();
  const results = [];

  for (const candidate of candidates) {
    if (candidate.matchScore < 70) continue;

    try {
      const vehicleIds: number[] = [];
      if (candidate.iceVehicle) vehicleIds.push(candidate.iceVehicle.id);
      if (candidate.phevVehicle) vehicleIds.push(candidate.phevVehicle.id);
      if (candidate.evVehicle) vehicleIds.push(candidate.evVehicle.id);

      const chain = await createChainComparison(
        candidate.modelSeries,
        vehicleIds,
        ChainStatus.DRAFT,
      );
      results.push({
        success: true,
        modelSeries: candidate.modelSeries,
        chain,
        matchScore: candidate.matchScore,
      });
    } catch (e: any) {
      results.push({
        success: false,
        modelSeries: candidate.modelSeries,
        error: e.message,
        matchScore: candidate.matchScore,
      });
    }
  }

  return {
    totalCandidates: candidates.length,
    createdCount: results.filter((r) => r.success).length,
    results,
  };
}

export async function getAllChainComparisons(status?: string, vehicleClass?: string) {
  const where: any = {};
  if (status) where.status = status;
  if (vehicleClass) where.vehicleClass = vehicleClass;

  const chains = await prisma.chainComparison.findMany({
    where,
    include: {
      items: {
        include: {
          vehicle: true,
        },
        orderBy: { sequence: 'asc' },
      },
    },
    orderBy: [{ brand: 'asc' }, { modelSeries: 'asc' }],
  });

  return Promise.all(chains.map((chain) => enrichChainWithAnalysis(chain)));
}

export async function getChainComparison(id: number) {
  const chain = await prisma.chainComparison.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          vehicle: true,
        },
        orderBy: { sequence: 'asc' },
      },
    },
  });

  if (!chain) {
    throw new Error('Chain comparison not found');
  }

  return enrichChainWithAnalysis(chain);
}

async function enrichChainWithAnalysis(chain: any): Promise<ChainComparisonDetail> {
  const sortedItems = [...chain.items].sort((a, b) => a.sequence - b.sequence);
  const baseWeight = sortedItems[0]?.curbWeight || 0;
  const evItem = sortedItems.find((item) => item.powerType === PowerType.EV);
  const phevItem = sortedItems.find((item) => item.powerType === PowerType.PHEV);
  const iceItem = sortedItems.find((item) => item.powerType === PowerType.ICE);

  const enrichedItems = await Promise.all(
    sortedItems.map(async (item, index) => {
      let analysis: any = {};
      if (index > 0) {
        const prevItem = sortedItems[index - 1];
        analysis = analyzeWeightGainCause(prevItem.vehicle, item.vehicle);
      }

      return {
        id: item.id,
        vehicleId: item.vehicleId,
        powerType: item.powerType,
        modelName: item.vehicle.modelName,
        curbWeight: item.curbWeight,
        weightFromPrevious: item.weightFromPrevious,
        weightFromBase: item.weightFromBase,
        batteryKwh: item.batteryKwh,
        sequence: item.sequence,
        primaryCause: analysis.primaryCause,
        causeTags: analysis.causeTags,
        breakdown: analysis.breakdown,
      };
    }),
  );

  const totalWeightGain = evItem ? evItem.curbWeight - baseWeight : 0;
  const totalWeightGainPct =
    baseWeight > 0 ? Math.round((totalWeightGain / baseWeight) * 10000) / 100 : 0;

  return {
    id: chain.id,
    modelSeries: chain.modelSeries,
    brand: chain.brand,
    platform: chain.platform,
    vehicleClass: chain.vehicleClass,
    status: chain.status,
    items: enrichedItems,
    summary: {
      totalWeightGain,
      totalWeightGainPct,
      iceToPhevGain: iceItem && phevItem ? phevItem.curbWeight - iceItem.curbWeight : null,
      phevToEvGain: phevItem && evItem ? evItem.curbWeight - phevItem.curbWeight : null,
      iceToEvGain:
        iceItem && evItem
          ? evItem.curbWeight - iceItem.curbWeight
          : evItem
            ? evItem.curbWeight - baseWeight
            : 0,
    },
    createdAt: chain.createdAt,
    updatedAt: chain.updatedAt,
  };
}

export async function updateChainStatus(id: number, status: string) {
  return prisma.chainComparison.update({
    where: { id },
    data: { status },
  });
}

export async function deleteChainComparison(id: number) {
  await prisma.chainComparisonItem.deleteMany({
    where: { chainComparisonId: id },
  });
  return prisma.chainComparison.delete({
    where: { id },
  });
}

export async function getChainComparisonWithPairs(id: number) {
  const chain = await getChainComparison(id);

  const pairs = await prisma.vehiclePair.findMany({
    where: {
      OR: [
        {
          AND: [
            { iceVehicleId: { in: chain.items.map((i) => i.vehicleId) } },
            { evVehicleId: { in: chain.items.map((i) => i.vehicleId) } },
          ],
        },
        {
          AND: [
            { iceVehicleId: { in: chain.items.map((i) => i.vehicleId) } },
            { phevVehicleId: { in: chain.items.map((i) => i.vehicleId) } },
          ],
        },
        {
          AND: [
            { phevVehicleId: { in: chain.items.map((i) => i.vehicleId) } },
            { evVehicleId: { in: chain.items.map((i) => i.vehicleId) } },
          ],
        },
      ],
    },
    include: {
      iceVehicle: true,
      phevVehicle: true,
      evVehicle: true,
    },
  });

  return {
    ...chain,
    relatedPairs: pairs,
  };
}
