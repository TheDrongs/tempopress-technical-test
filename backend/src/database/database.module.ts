import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { createDatabasePool, DATABASE_POOL } from './database.pool.js';
import { TRANSACTION_MANAGER } from './transaction-manager.js';

@Module({
  providers: [
    { provide: DATABASE_POOL, useFactory: () => createDatabasePool() },
    DatabaseService,
    { provide: TRANSACTION_MANAGER, useExisting: DatabaseService },
  ],
  exports: [DatabaseService, TRANSACTION_MANAGER],
})
export class DatabaseModule {}
