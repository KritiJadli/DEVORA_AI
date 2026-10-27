import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import webhookRoutes from './routes/webhooks.js';
import { errorHandler, notFound } from './lib/http.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',') }));
  // keep the raw body: GitHub webhook signatures are computed over the exact bytes
  app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('tiny'));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300 }));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, limit: 60 }), authRoutes);
  app.use('/api/projects', projectRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
