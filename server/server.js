import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import caseRoutes from './routes/cases.js';
import directiveRoutes from './routes/directives.js';
import dashboardRoutes from './routes/dashboard.js';
import userRoutes from './routes/users.js';
import { notFound, errorHandler } from './middleware/error.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { seedDatabase } from './scripts/seedData.js';
import { syncAllActionPlansFromDirectives } from './services/actionPlanSync.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const allowedOrigins = env.clientOrigins;
let httpServer;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:517\d$/.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by CORS.'));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (env.isProduction) {
  app.set('trust proxy', 1);
}
app.use(morgan(env.isProduction ? 'combined' : 'dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'AdhikarLoop API',
    message: 'Backend is running. Open the frontend at http://localhost:5173',
    endpoints: {
      health: '/api/health',
      login: '/api/auth/login'
    }
  });
});

app.get('/api', (_req, res) => {
  res.json({
    ok: true,
    service: 'AdhikarLoop API',
    health: '/api/health'
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'AdhikarLoop API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/directives', directiveRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

async function shutdown(signal) {
  logger.warn(`Received ${signal}. Shutting down service gracefully.`);
  try {
    if (httpServer) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
    await disconnectDatabase();
    logger.info('Service shutdown completed.');
    process.exit(0);
  } catch (error) {
    logger.error('Graceful shutdown failed.', { message: error.message });
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection.', { reason: String(reason) });
});

async function startServer() {
  try {
    const { mode } = await connectDatabase();

    if (env.autoSeed || mode === 'memory') {
      const result = await seedDatabase({ reset: false });
      logger.info(result.skipped ? 'Demo seed skipped; database already has users.' : 'Demo seed completed.');
    }
    await syncAllActionPlansFromDirectives();
    logger.info('Action plans synchronized from directive records.');

    httpServer = app.listen(env.port, () => {
      logger.info(`AdhikarLoop API running on port ${env.port} (${mode} database)`, {
        nodeEnv: env.nodeEnv,
        origins: allowedOrigins
      });
    });

    httpServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${env.port} is already in use.`);
        process.exit(1);
      }
      throw error;
    });
  } catch (error) {
    logger.error('Startup failed. MongoDB connection could not be established.', { message: error.message });
    process.exit(1);
  }
}

startServer();
