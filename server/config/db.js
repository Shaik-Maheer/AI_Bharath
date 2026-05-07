import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import dns from 'dns';

let memoryServer;

async function connectMemory() {
  memoryServer = await MongoMemoryServer.create({ instance: { dbName: 'adhikarloop' } });
  const uri = memoryServer.getUri();
  await mongoose.connect(uri);
  return { mode: 'memory', uri };
}

export async function connectDatabase() {
  const requestedUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/adhikarloop';

  if (requestedUri === 'memory') {
    return connectMemory();
  }

  if (requestedUri.startsWith('mongodb+srv://')) {
    dns.setServers((process.env.MONGO_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((server) => server.trim()));
  }

  try {
    await mongoose.connect(requestedUri);
    return { mode: 'persistent', uri: requestedUri };
  } catch (error) {
    if (process.env.MONGO_FALLBACK_TO_MEMORY === 'true') {
      console.warn(`Persistent MongoDB unavailable (${error.code || error.message}). Falling back to in-memory MongoDB.`);
      return connectMemory();
    }

    throw error;
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
