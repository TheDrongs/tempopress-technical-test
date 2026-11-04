import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DATABASE_POOL } from './database.pool.js';
import type { TransactionManager } from './transaction-manager.js';

interface TransactionContext {
  client: PoolClient;
  active: boolean;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy, TransactionManager {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly transactions = new AsyncLocalStorage<TransactionContext>();

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {
    this.pool.on('error', () => {
      this.logger.warn('An idle PostgreSQL connection was interrupted.');
    });
  }

  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>> {
    const context = this.transactions.getStore();
    if (context && !context.active) {
      throw new Error('The transaction context is already closed.');
    }
    const executor = context?.client ?? this.pool;
    return executor.query<Row>(text, values);
  }

  async withTransaction<T>(operation: () => Promise<T>): Promise<T> {
    if (this.transactions.getStore()) {
      throw new Error('Nested transactions are not supported.');
    }

    const client = await this.pool.connect();
    const context: TransactionContext = { client, active: true };
    let discardError: Error | undefined;

    try {
      await client.query('BEGIN');
      const result = await this.transactions.run(context, operation);
      context.active = false;
      const commit = await client.query('COMMIT');
      if (commit.command !== 'COMMIT') {
        throw new Error('The transaction could not be committed.');
      }
      return result;
    } catch (error) {
      context.active = false;
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        discardError =
          rollbackError instanceof Error
            ? rollbackError
            : new Error('PostgreSQL rollback failed.');
        throw new AggregateError(
          [error, rollbackError],
          'The transaction failed and could not be rolled back.',
        );
      }
      throw error;
    } finally {
      context.active = false;
      client.release(discardError);
    }
  }

  async checkConnection(): Promise<void> {
    await this.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    this.transactions.disable();
  }
}
