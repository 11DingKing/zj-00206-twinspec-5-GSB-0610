import type { Request, Response } from 'express';
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import type { VehicleClass } from '../types';
import { PairStatus, PairType } from '../types';
import {
  createPair,
  autoPairAllVehicles,
  updatePairStatus,
  recalculatePairMetrics,
  findSmartPairingCandidates,
  getSmartCandidates,
  batchConfirmPairs,
  getCauseAnalysis,
} from '../services/pairingService';
import { parseCauseTags } from '../utils/weightCalculator';
import { getPairedVehicleIds } from '../utils/pairValidator';
import { deduplicatePairsByVehicle } from '../utils/pairMetrics';
import { findPairedPairsForCauseStats } from '../repositories/pairRepository';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, vehicleClass, pairType } = req.query;
    const where: any = {};

    if (status) where.status = status as PairStatus;
    if (vehicleClass) where.vehicleClass = vehicleClass as VehicleClass;
    if (pairType) where.pairType = pairType as PairType;

    const pairs = await prisma.vehiclePair.findMany({
      where,
      include: {
        iceVehicle: true,
        phevVehicle: true,
        evVehicle: true,
      },
      orderBy: [{ weightGainPct: 'desc' }],
    });

    res.json(pairs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pairs' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const pair = await prisma.vehiclePair.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        iceVehicle: true,
        phevVehicle: true,
        evVehicle: true,
      },
    });

    if (!pair) {
      return res.status(404).json({ error: 'Pair not found' });
    }

    res.json(pair);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pair' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { baseVehicleId, targetVehicleId, pairType, status } = req.body;

    if (!baseVehicleId || !targetVehicleId) {
      return res.status(400).json({ error: 'baseVehicleId and targetVehicleId are required' });
    }

    const result = await createPair(
      baseVehicleId,
      targetVehicleId,
      pairType || PairType.ICE_EV,
      status || PairStatus.PENDING,
    );
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/auto-pair', async (req: Request, res: Response) => {
  try {
    const result = await autoPairAllVehicles();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to auto-pair vehicles' });
  }
});

router.get('/candidates/list', async (req: Request, res: Response) => {
  try {
    const pairedIds = await getPairedVehicleIds();

    const vehicles = await prisma.vehicle.findMany({
      where: {
        id: { notIn: Array.from(pairedIds) },
      },
    });

    const minScore = parseInt(req.query.minScore as string) || 65;
    const candidates = findSmartPairingCandidates(vehicles, minScore);
    res.json({
      total: candidates.length,
      candidates: candidates.slice(0, 50),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to find pairing candidates' });
  }
});

router.get('/candidates/for-vehicle/:vehicleId', async (req: Request, res: Response) => {
  try {
    const vehicleId = parseInt(req.params.vehicleId);
    const minScore = parseInt(req.query.minScore as string) || 60;

    const candidates = await getSmartCandidates(vehicleId, minScore);
    res.json({
      total: candidates.length,
      candidates,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;

    if (!status || !Object.values(PairStatus).includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }

    const pair = await updatePairStatus(parseInt(req.params.id), status);
    res.json(pair);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/batch-confirm', async (req: Request, res: Response) => {
  try {
    const { pairIds, status } = req.body;

    if (!Array.isArray(pairIds) || pairIds.length === 0) {
      return res.status(400).json({ error: 'pairIds array is required' });
    }

    if (status && !Object.values(PairStatus).includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const results = await batchConfirmPairs(pairIds, status || PairStatus.PAIRED);
    res.json({
      total: results.length,
      successCount: results.filter((r) => r.success).length,
      results,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/recalculate', async (req: Request, res: Response) => {
  try {
    const pair = await recalculatePairMetrics(parseInt(req.params.id));
    res.json(pair);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/cause-analysis', async (req: Request, res: Response) => {
  try {
    const analysis = await getCauseAnalysis(parseInt(req.params.id));
    res.json(analysis);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/cause/statistics', async (req: Request, res: Response) => {
  try {
    const pairs = await findPairedPairsForCauseStats();
    const { uniquePairs, seenVehicleIds } = deduplicatePairsByVehicle(pairs);

    const causeStats: Record<
      string,
      {
        count: number;
        avgWeightDiffKg: number;
        avgWeightGainPct: number;
      }
    > = {};

    const tagStats: Record<string, number> = {};

    uniquePairs.forEach((pair) => {
      const cause = pair.primaryCause || 'UNKNOWN';
      if (!causeStats[cause]) {
        causeStats[cause] = {
          count: 0,
          avgWeightDiffKg: 0,
          avgWeightGainPct: 0,
        };
      }
      causeStats[cause].count++;
      causeStats[cause].avgWeightDiffKg += pair.weightDiffKg || 0;
      causeStats[cause].avgWeightGainPct += pair.weightGainPct || 0;

      if (pair.causeTags) {
        const tags = parseCauseTags(pair.causeTags);
        tags.forEach((tag) => {
          tagStats[tag] = (tagStats[tag] || 0) + 1;
        });
      }
    });

    Object.keys(causeStats).forEach((cause) => {
      causeStats[cause].avgWeightDiffKg =
        Math.round((causeStats[cause].avgWeightDiffKg / causeStats[cause].count) * 10) / 10;
      causeStats[cause].avgWeightGainPct =
        Math.round((causeStats[cause].avgWeightGainPct / causeStats[cause].count) * 100) / 100;
    });

    res.json({
      byPrimaryCause: causeStats,
      byTag: tagStats,
      totalPairs: uniquePairs.length,
      uniqueVehicleCount: seenVehicleIds.size,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cause statistics' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const pair = await prisma.vehiclePair.findUnique({ where: { id } });

    if (!pair) {
      return res.status(404).json({ error: 'Pair not found' });
    }

    await prisma.vehiclePair.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete pair' });
  }
});

export default router;
