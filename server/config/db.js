import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import dns from 'dns';
import { env, isAtlasUri } from './env.js';
import { logger } from './logger.js';

let memoryServer;
let reconnectInProgress = false;
let intentionalShutdown = false;
let handlersAttached = false;
let mode = 'persistent';
let activeUri = '';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskMongoUri(uri) {
  return String(uri).replace(/\/\/([^:/?#]+):([^@]+)@/, '//***:***@');
}

function connectionOptions() {
  return {
    autoIndex: !env.isProduction,
    maxPoolSize: env.dbMaxPoolSize,
    minPoolSize: env.dbMinPoolSize,
    serverSelectionTimeoutMS: env.dbServerSelectionTimeoutMs,
    socketTimeoutMS: env.dbSocketTimeoutMs
  };
}

async function connectWithRetry(uri, retries = env.dbMaxRetries) {
  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    attempt += 1;
    try {
      await mongoose.connect(uri, connectionOptions());
      logger.info('MongoDB connection established.', {
        attempt,
        uri: maskMongoUri(uri),
        dbName: mongoose.connection.name,
        host: mongoose.connection.host
      });
      return;
    } catch (error) {
      lastError = error;
      logger.error('MongoDB connection attempt failed.', {
        attempt,
        retries,
        code: error.code || '',
        message: error.message
      });
      if (attempt > retries) break;
      await sleep(env.dbRetryDelayMs * attempt);
    }
  }

  throw lastError;
}

async function connectMemory() {
  memoryServer = await MongoMemoryServer.create({ instance: { dbName: 'aibharath' } });
  const uri = memoryServer.getUri();
  await mongoose.connect(uri, connectionOptions());
  logger.warn('Using in-memory MongoDB. Data will be lost when server stops.', { uri: maskMongoUri(uri) });
  return { mode: 'memory', uri };
}

async function reconnectPersistent() {
  if (intentionalShutdown || reconnectInProgress || mode !== 'persistent') return;
  reconnectInProgress = true;
  logger.warn('MongoDB disconnected. Starting background reconnect attempts.');

  while (!intentionalShutdown) {
    try {
      await connectWithRetry(activeUri, 0);
      reconnectInProgress = false;
      logger.info('MongoDB reconnect successful.');
      return;
    } catch (error) {
      logger.error('MongoDB reconnect failed. Retrying...', { message: error.message });
      await sleep(env.dbRetryDelayMs);
    }
  }

  reconnectInProgress = false;
}

function attachConnectionHandlers() {
  if (handlersAttached) return;
  handlersAttached = true;

  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    logger.info('MongoDB event: connected.', { dbName: mongoose.connection.name });
  });

  mongoose.connection.on('error', (error) => {
    logger.error('MongoDB event: connection error.', { code: error.code || '', message: error.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB event: disconnected.');
    reconnectPersistent().catch((error) => {
      logger.error('MongoDB reconnect flow crashed.', { message: error.message });
    });
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB event: reconnected.');
  });
}

export async function connectDatabase() {
  attachConnectionHandlers();
  intentionalShutdown = false;
  const requestedUri = env.mongoUri;

  if (requestedUri === 'memory') {
    mode = 'memory';
    const memory = await connectMemory();
    activeUri = memory.uri;
    return memory;
  }

  if (isAtlasUri(requestedUri) && env.mongoDnsServers.length) {
    dns.setServers(env.mongoDnsServers);
  }

  try {
    mode = 'persistent';
    activeUri = requestedUri;
    await connectWithRetry(requestedUri);
    return { mode, uri: requestedUri };
  } catch (error) {
    if (env.mongoFallbackToMemory) {
      logger.warn('Persistent MongoDB unavailable. Falling back to memory mode.', { reason: error.message });
      mode = 'memory';
      const memory = await connectMemory();
      activeUri = memory.uri;
      return memory;
    }
    throw error;
  }
}

export async function disconnectDatabase() {
  intentionalShutdown = true;
  try {
    await mongoose.disconnect();
  } finally {
    if (memoryServer) {
      await memoryServer.stop();
      memoryServer = null;
    }
  }
}
