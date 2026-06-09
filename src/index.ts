import type { Request, Response } from 'express';
import express from 'express';
import cors from 'cors';
import * as path from 'path';
import vehiclesRouter from './routes/vehicles';
import pairsRouter from './routes/pairs';
import analyticsRouter from './routes/analytics';
import chainRouter from './routes/chain';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'TwinSpec - 油电车型重量对比分析系统',
  });
});

app.use('/api/vehicles', vehiclesRouter);
app.use('/api/pairs', pairsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/chains', chainRouter);

app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════════════════════╗
  ║                                                            ║
  ║   TwinSpec - 油电车型重量对比分析系统                      ║
  ║                                                            ║
  ║   服务已启动: http://localhost:${PORT}                        ║
  ║                                                            ║
  ║   API 文档:                                                 ║
  ║   GET  /api/health          - 健康检查                     ║
  ║   GET  /api/vehicles        - 获取所有车辆                 ║
  ║   GET  /api/pairs           - 获取所有配对                 ║
  ║   GET  /api/analytics/full-report - 获取完整分析报告       ║
  ║                                                            ║
  ╚════════════════════════════════════════════════════════════╝
  `);
});
