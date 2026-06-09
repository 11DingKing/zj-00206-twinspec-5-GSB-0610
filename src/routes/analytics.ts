import type { Request, Response } from 'express';
import { Router } from 'express';
import { VehicleClass } from '../types';
import {
  getExtremeWeightGains,
  getClassWiseStatistics,
  getOverallStatistics,
  getBatteryCorrelationAnalysis,
  getPairsByClass,
  getCauseStatistics,
  getPairTypeStatistics,
  getChainStatistics,
} from '../services/analyticsService';

const router = Router();

router.get('/overview', async (req: Request, res: Response) => {
  try {
    const stats = await getOverallStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch overview statistics' });
  }
});

router.get('/by-class', async (req: Request, res: Response) => {
  try {
    const stats = await getClassWiseStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch class statistics' });
  }
});

router.get('/extreme-gains', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const extremes = await getExtremeWeightGains(limit);
    res.json(extremes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch extreme weight gains' });
  }
});

router.get('/battery-correlation', async (req: Request, res: Response) => {
  try {
    const analysis = await getBatteryCorrelationAnalysis();
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch battery correlation analysis' });
  }
});

router.get('/pairs/by-class', async (req: Request, res: Response) => {
  try {
    const { vehicleClass } = req.query;
    const pairs = await getPairsByClass(vehicleClass ? (vehicleClass as VehicleClass) : undefined);
    res.json(pairs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pairs by class' });
  }
});

router.get('/cause-statistics', async (req: Request, res: Response) => {
  try {
    const stats = await getCauseStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cause statistics' });
  }
});

router.get('/pair-type-statistics', async (req: Request, res: Response) => {
  try {
    const stats = await getPairTypeStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pair type statistics' });
  }
});

router.get('/chain-statistics', async (req: Request, res: Response) => {
  try {
    const stats = await getChainStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chain statistics' });
  }
});

router.get('/full-report', async (req: Request, res: Response) => {
  try {
    const [overview, classStats, extremes, batteryAnalysis, causeStats, pairTypeStats, chainStats] =
      await Promise.all([
        getOverallStatistics(),
        getClassWiseStatistics(),
        getExtremeWeightGains(10),
        getBatteryCorrelationAnalysis(),
        getCauseStatistics(),
        getPairTypeStatistics(),
        getChainStatistics(),
      ]);

    const sedanPairs = await getPairsByClass(VehicleClass.SEDAN);
    const suvPairs = await getPairsByClass(VehicleClass.SUV);
    const mpvPairs = await getPairsByClass(VehicleClass.MPV);

    res.json({
      overview,
      classStatistics: classStats,
      topExtremeGains: extremes,
      batteryCorrelation: batteryAnalysis,
      causeStatistics: causeStats,
      pairTypeStatistics: pairTypeStats,
      chainStatistics: chainStats,
      pairsByClass: {
        SEDAN: sedanPairs,
        SUV: suvPairs,
        MPV: mpvPairs,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate full report' });
  }
});

export default router;
