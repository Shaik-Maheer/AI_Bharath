import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = process.env.ENV_FILE || path.join(__dirname, '..', '.env');

dotenv.config({ path: envPath });

function toInt(raw, fallback) {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(raw, fallback = false) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  return String(raw).toLowerCase() === 'true';
}

function splitCsv(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Environment validation failed: ${message}`);
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isDevelopment = nodeEnv === 'development';

const mongoUri = (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();
const jwtSecret = (process.env.JWT_SECRET || '').trim();

assert(mongoUri, 'Set MONGODB_URI (or MONGO_URI) to a valid MongoDB connection string.');
assert(
  mongoUri === 'memory' || mongoUri.startsWith('mongodb://') || mongoUri.startsWith('mongodb+srv://'),
  'MONGODB_URI must start with mongodb:// or mongodb+srv://, or be set to memory for demo mode.'
);

if (isProduction) {
  assert(jwtSecret.length >= 16, 'JWT_SECRET must be at least 16 characters in production.');
}

const origins = splitCsv(process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174');
if (process.env.RENDER_EXTERNAL_URL) origins.push(process.env.RENDER_EXTERNAL_URL.trim());
if (process.env.RENDER_EXTERNAL_HOSTNAME) origins.push(`https://${String(process.env.RENDER_EXTERNAL_HOSTNAME).trim()}`);

export const env = {
  nodeEnv,
  isProduction,
  isDevelopment,
  port: toInt(process.env.PORT, 5000),
  jwtSecret: jwtSecret || 'adhikarloop-dev-secret-change-me',
  mongoUri,
  mongoDnsServers: splitCsv(process.env.MONGO_DNS_SERVERS || '8.8.8.8,1.1.1.1'),
  mongoFallbackToMemory: toBool(process.env.MONGO_FALLBACK_TO_MEMORY, false),
  autoSeed: toBool(process.env.AUTO_SEED, false),
  dbMaxRetries: toInt(process.env.DB_MAX_RETRIES, 5),
  dbRetryDelayMs: toInt(process.env.DB_RETRY_DELAY_MS, 2000),
  dbServerSelectionTimeoutMs: toInt(process.env.DB_SERVER_SELECTION_TIMEOUT_MS, 10000),
  dbSocketTimeoutMs: toInt(process.env.DB_SOCKET_TIMEOUT_MS, 45000),
  dbMaxPoolSize: toInt(process.env.DB_MAX_POOL_SIZE, 20),
  dbMinPoolSize: toInt(process.env.DB_MIN_POOL_SIZE, 2),
  clientOrigins: [...new Set(origins)]
};

export function isAtlasUri(uri = env.mongoUri) {
  return String(uri).startsWith('mongodb+srv://');
}

