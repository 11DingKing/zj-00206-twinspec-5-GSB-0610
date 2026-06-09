import { PrismaClient } from '@prisma/client';
import {
  analyzeWeightDifference,
  analyzeWeightGainCause,
  formatCauseTags,
} from '../src/utils/weightCalculator';
import { calculateMatchScore } from '../src/services/pairingService';

const prisma = new PrismaClient();

const POWER_TYPE = {
  ICE: 'ICE',
  PHEV: 'PHEV',
  EV: 'EV',
} as const;

const PAIR_TYPE = {
  ICE_EV: 'ICE_EV',
  ICE_PHEV: 'ICE_PHEV',
  PHEV_EV: 'PHEV_EV',
} as const;

const PAIR_STATUS = {
  PENDING: 'PENDING',
  PAIRED: 'PAIRED',
  REVIEW: 'REVIEW',
} as const;

const CHAIN_STATUS = {
  ACTIVE: 'ACTIVE',
  DRAFT: 'DRAFT',
  ARCHIVED: 'ARCHIVED',
} as const;

interface VehicleSeed {
  modelName: string;
  modelSeries?: string;
  brand: string;
  year: number;
  powerType: string;
  vehicleClass: string;
  platform: string;
  trimLevel: string;
  curbWeight: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  wheelbaseMm: number;
  batteryKwh?: number;
  featureCount?: number;
}

const vehicles: VehicleSeed[] = [
  {
    modelName: '3 Series',
    modelSeries: '3 Series',
    brand: 'BMW',
    year: 2024,
    powerType: POWER_TYPE.ICE,
    vehicleClass: 'SEDAN',
    platform: 'CLAR',
    trimLevel: 'HIGH',
    curbWeight: 1585,
    lengthMm: 4728,
    widthMm: 1827,
    heightMm: 1452,
    wheelbaseMm: 2851,
    featureCount: 25,
  },
  {
    modelName: '3 Series PHEV',
    modelSeries: '3 Series',
    brand: 'BMW',
    year: 2024,
    powerType: POWER_TYPE.PHEV,
    vehicleClass: 'SEDAN',
    platform: 'CLAR',
    trimLevel: 'HIGH',
    curbWeight: 1820,
    lengthMm: 4728,
    widthMm: 1827,
    heightMm: 1452,
    wheelbaseMm: 2851,
    batteryKwh: 30,
    featureCount: 28,
  },
  {
    modelName: 'i3',
    modelSeries: '3 Series',
    brand: 'BMW',
    year: 2024,
    powerType: POWER_TYPE.EV,
    vehicleClass: 'SEDAN',
    platform: 'CLAR',
    trimLevel: 'HIGH',
    curbWeight: 2030,
    lengthMm: 4872,
    widthMm: 1846,
    heightMm: 1481,
    wheelbaseMm: 2966,
    batteryKwh: 70,
    featureCount: 32,
  },

  {
    modelName: '5 Series',
    modelSeries: '5 Series',
    brand: 'BMW',
    year: 2024,
    powerType: POWER_TYPE.ICE,
    vehicleClass: 'SEDAN',
    platform: 'CLAR',
    trimLevel: 'PREMIUM',
    curbWeight: 1775,
    lengthMm: 5106,
    widthMm: 1900,
    heightMm: 1511,
    wheelbaseMm: 3105,
    featureCount: 35,
  },
  {
    modelName: '5 Series PHEV',
    modelSeries: '5 Series',
    brand: 'BMW',
    year: 2024,
    powerType: POWER_TYPE.PHEV,
    vehicleClass: 'SEDAN',
    platform: 'CLAR',
    trimLevel: 'PREMIUM',
    curbWeight: 2050,
    lengthMm: 5106,
    widthMm: 1900,
    heightMm: 1511,
    wheelbaseMm: 3105,
    batteryKwh: 40,
    featureCount: 38,
  },
  {
    modelName: 'i5',
    modelSeries: '5 Series',
    brand: 'BMW',
    year: 2024,
    powerType: POWER_TYPE.EV,
    vehicleClass: 'SEDAN',
    platform: 'CLAR',
    trimLevel: 'PREMIUM',
    curbWeight: 2305,
    lengthMm: 5106,
    widthMm: 1900,
    heightMm: 1511,
    wheelbaseMm: 3105,
    batteryKwh: 84,
    featureCount: 42,
  },

  {
    modelName: 'X3',
    modelSeries: 'X3',
    brand: 'BMW',
    year: 2024,
    powerType: POWER_TYPE.ICE,
    vehicleClass: 'SUV',
    platform: 'CLAR',
    trimLevel: 'HIGH',
    curbWeight: 1825,
    lengthMm: 4737,
    widthMm: 1891,
    heightMm: 1676,
    wheelbaseMm: 2864,
    featureCount: 28,
  },
  {
    modelName: 'X3 PHEV',
    modelSeries: 'X3',
    brand: 'BMW',
    year: 2024,
    powerType: POWER_TYPE.PHEV,
    vehicleClass: 'SUV',
    platform: 'CLAR',
    trimLevel: 'HIGH',
    curbWeight: 2080,
    lengthMm: 4737,
    widthMm: 1891,
    heightMm: 1676,
    wheelbaseMm: 2864,
    batteryKwh: 35,
    featureCount: 30,
  },
  {
    modelName: 'iX3',
    modelSeries: 'X3',
    brand: 'BMW',
    year: 2024,
    powerType: POWER_TYPE.EV,
    vehicleClass: 'SUV',
    platform: 'CLAR',
    trimLevel: 'HIGH',
    curbWeight: 2255,
    lengthMm: 4746,
    widthMm: 1891,
    heightMm: 1683,
    wheelbaseMm: 2864,
    batteryKwh: 80,
    featureCount: 35,
  },

  {
    modelName: 'Han DM',
    modelSeries: 'Han',
    brand: 'BYD',
    year: 2024,
    powerType: POWER_TYPE.ICE,
    vehicleClass: 'SEDAN',
    platform: 'e-Platform 4.0',
    trimLevel: 'HIGH',
    curbWeight: 2050,
    lengthMm: 4975,
    widthMm: 1910,
    heightMm: 1495,
    wheelbaseMm: 2920,
    batteryKwh: 25,
    featureCount: 35,
  },
  {
    modelName: 'Han PHEV',
    modelSeries: 'Han',
    brand: 'BYD',
    year: 2024,
    powerType: POWER_TYPE.PHEV,
    vehicleClass: 'SEDAN',
    platform: 'e-Platform 4.0',
    trimLevel: 'HIGH',
    curbWeight: 2150,
    lengthMm: 4975,
    widthMm: 1910,
    heightMm: 1495,
    wheelbaseMm: 2920,
    batteryKwh: 45,
    featureCount: 38,
  },
  {
    modelName: 'Han EV',
    modelSeries: 'Han',
    brand: 'BYD',
    year: 2024,
    powerType: POWER_TYPE.EV,
    vehicleClass: 'SEDAN',
    platform: 'e-Platform 4.0',
    trimLevel: 'HIGH',
    curbWeight: 2250,
    lengthMm: 4995,
    widthMm: 1910,
    heightMm: 1495,
    wheelbaseMm: 2920,
    batteryKwh: 85,
    featureCount: 42,
  },

  {
    modelName: 'Tang DM',
    modelSeries: 'Tang',
    brand: 'BYD',
    year: 2024,
    powerType: POWER_TYPE.ICE,
    vehicleClass: 'SUV',
    platform: 'e-Platform 4.0',
    trimLevel: 'HIGH',
    curbWeight: 2320,
    lengthMm: 4870,
    widthMm: 1950,
    heightMm: 1725,
    wheelbaseMm: 2820,
    batteryKwh: 28,
    featureCount: 32,
  },
  {
    modelName: 'Tang PHEV',
    modelSeries: 'Tang',
    brand: 'BYD',
    year: 2024,
    powerType: POWER_TYPE.PHEV,
    vehicleClass: 'SUV',
    platform: 'e-Platform 4.0',
    trimLevel: 'HIGH',
    curbWeight: 2430,
    lengthMm: 4870,
    widthMm: 1950,
    heightMm: 1725,
    wheelbaseMm: 2820,
    batteryKwh: 48,
    featureCount: 35,
  },
  {
    modelName: 'Tang EV',
    modelSeries: 'Tang',
    brand: 'BYD',
    year: 2024,
    powerType: POWER_TYPE.EV,
    vehicleClass: 'SUV',
    platform: 'e-Platform 4.0',
    trimLevel: 'HIGH',
    curbWeight: 2560,
    lengthMm: 4900,
    widthMm: 1950,
    heightMm: 1725,
    wheelbaseMm: 2820,
    batteryKwh: 108,
    featureCount: 40,
  },

  {
    modelName: 'D9 DM',
    modelSeries: 'D9',
    brand: 'Denza',
    year: 2024,
    powerType: POWER_TYPE.ICE,
    vehicleClass: 'MPV',
    platform: 'e-Platform 4.0',
    trimLevel: 'HIGH',
    curbWeight: 2360,
    lengthMm: 5250,
    widthMm: 1960,
    heightMm: 1920,
    wheelbaseMm: 3110,
    batteryKwh: 30,
    featureCount: 40,
  },
  {
    modelName: 'D9 PHEV',
    modelSeries: 'D9',
    brand: 'Denza',
    year: 2024,
    powerType: POWER_TYPE.PHEV,
    vehicleClass: 'MPV',
    platform: 'e-Platform 4.0',
    trimLevel: 'HIGH',
    curbWeight: 2520,
    lengthMm: 5250,
    widthMm: 1960,
    heightMm: 1920,
    wheelbaseMm: 3110,
    batteryKwh: 55,
    featureCount: 42,
  },
  {
    modelName: 'D9 EV',
    modelSeries: 'D9',
    brand: 'Denza',
    year: 2024,
    powerType: POWER_TYPE.EV,
    vehicleClass: 'MPV',
    platform: 'e-Platform 4.0',
    trimLevel: 'HIGH',
    curbWeight: 2680,
    lengthMm: 5250,
    widthMm: 1960,
    heightMm: 1920,
    wheelbaseMm: 3110,
    batteryKwh: 103,
    featureCount: 48,
  },
];

async function main() {
  console.log('Seeding vehicles...');

  for (const vehicle of vehicles) {
    const data = {
      modelName: vehicle.modelName,
      modelSeries: vehicle.modelSeries || null,
      brand: vehicle.brand,
      year: vehicle.year,
      powerType: vehicle.powerType,
      vehicleClass: vehicle.vehicleClass,
      platform: vehicle.platform,
      trimLevel: vehicle.trimLevel,
      curbWeight: vehicle.curbWeight,
      lengthMm: vehicle.lengthMm,
      widthMm: vehicle.widthMm,
      heightMm: vehicle.heightMm,
      wheelbaseMm: vehicle.wheelbaseMm,
      batteryKwh:
        vehicle.powerType === POWER_TYPE.EV || vehicle.powerType === POWER_TYPE.PHEV
          ? vehicle.batteryKwh
          : null,
      featureCount: vehicle.featureCount || null,
    };
    const created = await prisma.vehicle.create({ data });
    console.log(`Created: ${created.brand} ${created.modelName} (${created.powerType})`);
  }

  console.log('\nCreating pairs for same platform vehicles...');

  const platformGroups: Record<string, VehicleSeed[]> = {};
  vehicles.forEach((v) => {
    const key = `${v.platform}-${v.vehicleClass}-${v.modelSeries || v.modelName}`;
    if (!platformGroups[key]) {
      platformGroups[key] = [];
    }
    platformGroups[key].push(v);
  });

  let pairCount = 0;

  for (const [, group] of Object.entries(platformGroups)) {
    const iceVehicles = group.filter((v) => v.powerType === POWER_TYPE.ICE);
    const phevVehicles = group.filter((v) => v.powerType === POWER_TYPE.PHEV);
    const evVehicles = group.filter((v) => v.powerType === POWER_TYPE.EV);

    const pairTypes = [
      { base: iceVehicles, target: phevVehicles, type: PAIR_TYPE.ICE_PHEV },
      { base: phevVehicles, target: evVehicles, type: PAIR_TYPE.PHEV_EV },
      { base: iceVehicles, target: evVehicles, type: PAIR_TYPE.ICE_EV },
    ];

    for (const pt of pairTypes) {
      if (pt.base.length > 0 && pt.target.length > 0) {
        const base = pt.base[0];
        const target = pt.target[0];

        const baseRecord = await prisma.vehicle.findFirst({
          where: {
            modelName: base.modelName,
            brand: base.brand,
            powerType: base.powerType,
          },
        });

        const targetRecord = await prisma.vehicle.findFirst({
          where: {
            modelName: target.modelName,
            brand: target.brand,
            powerType: target.powerType,
          },
        });

        if (baseRecord && targetRecord) {
          const weightAnalysis = analyzeWeightDifference(baseRecord, targetRecord);
          const causeAnalysis = analyzeWeightGainCause(baseRecord, targetRecord);
          const isExtreme = weightAnalysis.isExtremeGain;
          const { score } = calculateMatchScore(baseRecord, targetRecord, pt.type);

          const pairData: any = {
            modelName: base.modelName,
            brand: base.brand,
            platform: base.platform,
            vehicleClass: base.vehicleClass,
            pairType: pt.type,
            status: PAIR_STATUS.PAIRED,
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
            notes: isExtreme
              ? `极端增重! 电池相关性: ${weightAnalysis.batteryCorrelation}, 主因: ${causeAnalysis.primaryCause}`
              : null,
          };

          if (pt.type === PAIR_TYPE.ICE_EV) {
            pairData.iceVehicleId = baseRecord.id;
            pairData.evVehicleId = targetRecord.id;
          } else if (pt.type === PAIR_TYPE.ICE_PHEV) {
            pairData.iceVehicleId = baseRecord.id;
            pairData.phevVehicleId = targetRecord.id;
          } else if (pt.type === PAIR_TYPE.PHEV_EV) {
            pairData.phevVehicleId = baseRecord.id;
            pairData.evVehicleId = targetRecord.id;
          }

          await prisma.vehiclePair.create({
            data: pairData,
          });

          console.log(
            `Paired [${pt.type}]: ${base.brand} ${base.modelName} <-> ${target.modelName} | +${weightAnalysis.weightDiffKg}kg (+${weightAnalysis.weightGainPct}%) | 主因: ${causeAnalysis.primaryCause}`,
          );
          pairCount++;
        }
      }
    }
  }

  console.log(`\nCreating chain comparisons...`);

  const seriesGroups: Record<string, VehicleSeed[]> = {};
  vehicles.forEach((v) => {
    const seriesKey = v.modelSeries || v.modelName.replace(/\s+(EV|PHEV|DM).*$/i, '').trim();
    const key = `${v.brand}-${seriesKey}-${v.platform}-${v.vehicleClass}`;
    if (!seriesGroups[key]) {
      seriesGroups[key] = [];
    }
    seriesGroups[key].push(v);
  });

  let chainCount = 0;

  for (const [, group] of Object.entries(seriesGroups)) {
    const powerTypes = group.map((v) => v.powerType);
    if (powerTypes.length >= 2) {
      const modelSeries =
        group[0].modelSeries || group[0].modelName.replace(/\s+(EV|PHEV|DM).*$/i, '').trim();

      const sortedGroup = [...group].sort((a, b) => {
        const order = [POWER_TYPE.ICE, POWER_TYPE.PHEV, POWER_TYPE.EV];
        return order.indexOf(a.powerType as any) - order.indexOf(b.powerType as any);
      });

      const vehicleRecords = await Promise.all(
        sortedGroup.map((v) =>
          prisma.vehicle.findFirst({
            where: {
              modelName: v.modelName,
              brand: v.brand,
              powerType: v.powerType,
            },
          }),
        ),
      );

      const validVehicles = vehicleRecords.filter((v) => v !== null);
      if (validVehicles.length >= 2) {
        await prisma.chainComparison.create({
          data: {
            modelSeries,
            brand: group[0].brand,
            platform: group[0].platform,
            vehicleClass: group[0].vehicleClass,
            status: CHAIN_STATUS.ACTIVE,
            items: {
              create: validVehicles.map((vehicle, index) => {
                const v = vehicle!;
                const baseVehicle = validVehicles[0]!;
                const prevVehicle = index > 0 ? validVehicles[index - 1]! : null;

                return {
                  vehicleId: v.id,
                  powerType: v.powerType,
                  curbWeight: v.curbWeight,
                  weightFromPrevious: prevVehicle ? v.curbWeight - prevVehicle.curbWeight : null,
                  weightFromBase: index > 0 ? v.curbWeight - baseVehicle.curbWeight : null,
                  batteryKwh: v.batteryKwh,
                  sequence: index,
                };
              }),
            },
          },
        });

        const types = validVehicles.map((v) => v!.powerType).join(' -> ');
        console.log(`Created chain: ${group[0].brand} ${modelSeries} [${types}]`);
        chainCount++;
      }
    }
  }

  console.log(`\n✅ Seeding completed!`);
  console.log(`Created ${vehicles.length} vehicles`);
  console.log(`Created ${pairCount} vehicle pairs`);
  console.log(`Created ${chainCount} chain comparisons`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
