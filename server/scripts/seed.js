import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { seedDatabase } from './seedData.js';
import { logger } from '../config/logger.js';

async function main() {
  const { mode } = await connectDatabase();
  await seedDatabase({ reset: true });
  logger.info(`Seed complete (${mode} database): admin/reviewer/viewer users, 2 cases, 8 directives, and audit logs created.`);
  await disconnectDatabase();
}

main().catch(async (error) => {
  logger.error('Seed script failed.', { message: error.message });
  await disconnectDatabase();
  process.exit(1);
});
