import type { Request, Response } from 'express';
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import type { VehicleClass, TrimLevel } from '../types';
import { PowerType } from '../types';

const router = Router();
const prisma = new PrismaClient();

interface VehicleCreateInput {
  modelName: string;
  modelSeries?: string;
  brand: string;
  year: number;
  powerType: PowerType;
  vehicleClass: VehicleClass;
  platform: string;
  trimLevel: TrimLevel;
  curbWeight: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  wheelbaseMm: number;
  batteryKwh?: number;
  featureCount?: number;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const { powerType, vehicleClass, brand } = req.query;
    const where: any = {};

    if (powerType) where.powerType = powerType as PowerType;
    if (vehicleClass) where.vehicleClass = vehicleClass as VehicleClass;
    if (brand) where.brand = { contains: brand as string };

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: [{ brand: 'asc' }, { modelName: 'asc' }],
    });

    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data: VehicleCreateInput = req.body;

    if (data.powerType === PowerType.EV && !data.batteryKwh) {
      return res.status(400).json({ error: 'EV vehicles must have batteryKwh' });
    }

    if (data.powerType === PowerType.ICE && data.batteryKwh) {
      return res.status(400).json({ error: 'ICE vehicles should not have batteryKwh' });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        ...data,
        batteryKwh:
          data.powerType === PowerType.EV || data.powerType === PowerType.PHEV
            ? data.batteryKwh
            : null,
      },
    });

    res.status(201).json(vehicle);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data: Partial<VehicleCreateInput> = req.body;
    const existing = await prisma.vehicle.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: parseInt(req.params.id) },
      data,
    });

    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    await prisma.vehicle.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

router.get('/unpaired/list', async (req: Request, res: Response) => {
  try {
    const allPairs = await prisma.vehiclePair.findMany({
      select: { iceVehicleId: true, evVehicleId: true },
    });
    const pairedIceIds = new Set(allPairs.map((p) => p.iceVehicleId));
    const pairedEvIds = new Set(allPairs.map((p) => p.evVehicleId));

    const iceVehicles = await prisma.vehicle.findMany({
      where: {
        powerType: PowerType.ICE,
        id: {
          notIn: Array.from(pairedIceIds).filter((id): id is number => id !== null),
        },
      },
    });

    const evVehicles = await prisma.vehicle.findMany({
      where: {
        powerType: PowerType.EV,
        id: {
          notIn: Array.from(pairedEvIds).filter((id): id is number => id !== null),
        },
      },
    });

    res.json({
      ice: iceVehicles,
      ev: evVehicles,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unpaired vehicles' });
  }
});

export default router;
