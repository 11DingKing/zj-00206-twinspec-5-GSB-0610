import type { Request, Response } from 'express';
import { Router } from 'express';
import type { VehicleClass } from '../types';
import { ChainStatus } from '../types';
import {
  getAllChainComparisons,
  getChainComparison,
  getChainCandidates,
  createChainComparison,
  createChainFromVehicles,
  autoCreateChains,
  updateChainStatus,
  deleteChainComparison,
  getChainComparisonWithPairs,
} from '../services/chainComparisonService';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, vehicleClass } = req.query;
    const chains = await getAllChainComparisons(
      status as string | undefined,
      vehicleClass as VehicleClass | undefined,
    );
    res.json(chains);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chain comparisons' });
  }
});

router.get('/candidates', async (req: Request, res: Response) => {
  try {
    const candidates = await getChainCandidates();
    res.json({
      total: candidates.length,
      candidates,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get chain candidates' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const chain = await getChainComparison(parseInt(req.params.id));
    res.json(chain);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/:id/with-pairs', async (req: Request, res: Response) => {
  try {
    const chain = await getChainComparisonWithPairs(parseInt(req.params.id));
    res.json(chain);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { modelSeries, vehicleIds, status } = req.body;

    if (!modelSeries) {
      return res.status(400).json({ error: 'modelSeries is required' });
    }

    if (!Array.isArray(vehicleIds) || vehicleIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 vehicleIds are required' });
    }

    const chain = await createChainComparison(
      modelSeries,
      vehicleIds,
      status || ChainStatus.ACTIVE,
    );
    res.status(201).json(chain);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/from-vehicles', async (req: Request, res: Response) => {
  try {
    const { iceVehicleId, phevVehicleId, evVehicleId } = req.body;

    const vehicleIds: number[] = [];
    if (iceVehicleId) vehicleIds.push(iceVehicleId);
    if (phevVehicleId) vehicleIds.push(phevVehicleId);
    if (evVehicleId) vehicleIds.push(evVehicleId);

    if (vehicleIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 vehicle IDs are required' });
    }

    const chain = await createChainFromVehicles(iceVehicleId, phevVehicleId, evVehicleId);
    res.status(201).json(chain);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/auto-create', async (req: Request, res: Response) => {
  try {
    const result = await autoCreateChains();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to auto-create chains' });
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;

    if (!status || !Object.values(ChainStatus).includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }

    const chain = await updateChainStatus(parseInt(req.params.id), status);
    res.json(chain);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteChainComparison(parseInt(req.params.id));
    res.status(204).send();
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/overview/summary', async (req: Request, res: Response) => {
  try {
    const chains = await getAllChainComparisons(ChainStatus.ACTIVE);

    const byClass: Record<string, any[]> = {};
    let totalThreeVersion = 0;
    let totalTwoVersion = 0;
    const avgTotalGains: number[] = [];

    chains.forEach((chain) => {
      if (!byClass[chain.vehicleClass]) {
        byClass[chain.vehicleClass] = [];
      }
      byClass[chain.vehicleClass].push(chain);

      if (chain.items.length >= 3) {
        totalThreeVersion++;
      } else {
        totalTwoVersion++;
      }

      avgTotalGains.push(chain.summary.totalWeightGain);
    });

    const classSummary = Object.entries(byClass).map(([vehicleClass, classChains]) => {
      const avgGain =
        classChains.reduce((sum, c) => sum + c.summary.totalWeightGain, 0) / classChains.length;
      const avgGainPct =
        classChains.reduce((sum, c) => sum + c.summary.totalWeightGainPct, 0) / classChains.length;
      const threeVersionCount = classChains.filter((c) => c.items.length >= 3).length;

      return {
        vehicleClass,
        count: classChains.length,
        threeVersionCount,
        avgTotalWeightGainKg: Math.round(avgGain * 10) / 10,
        avgTotalWeightGainPct: Math.round(avgGainPct * 100) / 100,
      };
    });

    res.json({
      totalChains: chains.length,
      totalThreeVersionChains: totalThreeVersion,
      totalTwoVersionChains: totalTwoVersion,
      avgTotalWeightGainKg:
        avgTotalGains.length > 0
          ? Math.round((avgTotalGains.reduce((a, b) => a + b, 0) / avgTotalGains.length) * 10) / 10
          : 0,
      byClass: classSummary,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get chain overview' });
  }
});

export default router;
