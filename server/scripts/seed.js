import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { seedDatabase } from './seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const { mode } = await connectDatabase();
  await seedDatabase({ reset: true });
  console.log(`Seed complete (${mode} database): admin/reviewer/viewer users, 2 cases, 8 directives, and audit logs created.`);
  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
