import { Pool } from 'pg';
import type { PoolConfig } from 'pg';

export const DATABASE_POOL = Symbol('DATABASE_POOL');

export function createDatabasePool(overrides: PoolConfig = {}): Pool {
  return new Pool({
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? 'tempopress',
    user: process.env.PGUSER ?? 'tempopress',
    password: process.env.PGPASSWORD ?? 'tempopress_local',
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
    options: '-c search_path=public',
    ...overrides,
  });
}
