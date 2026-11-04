import 'reflect-metadata';
import { createDatabasePool } from '../database.pool.js';
import { DatabaseService } from '../database.service.js';
import { runMigrations } from './migrate.js';
import { seedDemoUsers } from './seed.js';

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!['migrate', 'seed', 'setup'].includes(command)) {
    throw new Error(
      'Usage: node dist/database/setup/cli.js <migrate|seed|setup>',
    );
  }

  const database = new DatabaseService(createDatabasePool());
  try {
    if (command === 'migrate' || command === 'setup') {
      const result = await runMigrations(database);
      console.log(
        `Migrations: ${result.applied.length} applied, ${result.skipped.length} already applied.`,
      );
    }
    if (command === 'seed' || command === 'setup') {
      const inserted = await seedDemoUsers(database);
      console.log(
        `Demo users: ${inserted} inserted; ADMIN, SPV, and MECHANIC are available.`,
      );
    }
  } finally {
    await database.onModuleDestroy();
  }
}

try {
  await main();
} catch (error) {
  console.error(
    'Database setup failed:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  process.exitCode = 1;
}
