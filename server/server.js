import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import caseRoutes from './routes/cases.js';
import directiveRoutes from './routes/directives.js';
import dashboardRoutes from './routes/dashboard.js';
import { notFound, errorHandler } from './middleware/error.js';
import { connectDatabase } from './config/db.js';
import { seedDatabase } from './scripts/seedData.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim());

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
app.use(morgan('dev'));
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
app.use('/api/cases', caseRoutes);
app.use('/api/directives', directiveRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;

connectDatabase()
  .then(async ({ mode }) => {
    if (process.env.AUTO_SEED === 'true' || mode === 'memory') {
      const result = await seedDatabase({ reset: false });
      console.log(result.skipped ? 'Demo seed skipped; database already has users.' : 'Demo seed completed.');
    }

    const server = app.listen(port, () => {
      console.log(`AdhikarLoop API running on http://localhost:${port} (${mode} database)`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the existing backend process or set PORT to another value in server/.env.`);
        process.exit(1);
      }

      throw error;
    });
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
    console.error('Start MongoDB locally, set MONGO_URI to a reachable MongoDB connection string, or run npm.cmd run dev:demo for in-memory demo mode.');
    process.exit(1);
  });
