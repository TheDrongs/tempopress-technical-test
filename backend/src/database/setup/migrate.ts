import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseService } from '../database.service.js';

export const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../../migrations/', import.meta.url),
);

interface AppliedMigration {
  filename: string;
  checksum: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export async function runMigrations(
  database: DatabaseService,
  directory = MIGRATIONS_DIRECTORY,
): Promise<MigrationResult> {
  const filenames = (await readdir(directory))
    .filter((filename) => /^\d+_[a-z0-9_]+\.sql$/.test(filename))
    .sort();
  if (filenames.length === 0) {
    throw new Error('No SQL migration files were found.');
  }

  return database.withTransaction(async () => {
    // Serialize concurrent setup processes until this transaction ends.
    await database.query(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [1413827920, 1296648018],
    );
    await database.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        filename TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const history = await database.query<AppliedMigration>(
      'SELECT filename, checksum FROM _schema_migrations ORDER BY filename',
    );
    const applied = new Map(
      history.rows.map((row) => [row.filename, row.checksum]),
    );

    for (const row of history.rows) {
      if (!filenames.includes(row.filename)) {
        throw new Error(
          `Previously applied migration is missing: ${row.filename}`,
        );
      }
    }

    const result: MigrationResult = { applied: [], skipped: [] };
    for (const filename of filenames) {
      const sql = (await readFile(join(directory, filename), 'utf8')).replace(
        /\r\n/g,
        '\n',
      );
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previousChecksum = applied.get(filename);

      if (previousChecksum) {
        if (previousChecksum !== checksum) {
          throw new Error(
            `Applied migration was modified: ${filename}. Add a new migration instead.`,
          );
        }
        result.skipped.push(filename);
        continue;
      }

      await database.query(sql);
      await database.query(
        'INSERT INTO _schema_migrations (filename, checksum) VALUES ($1, $2)',
        [filename, checksum],
      );
      result.applied.push(filename);
    }
    return result;
  });
}
