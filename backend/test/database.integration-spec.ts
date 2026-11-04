import { createDatabasePool } from '../src/database/database.pool.js';
import { DatabaseService } from '../src/database/database.service.js';

describe('PostgreSQL transaction boundaries (integration)', () => {
  let database: DatabaseService;

  beforeEach(async () => {
    // One connection keeps this test-only TEMP table on the same session.
    database = new DatabaseService(createDatabasePool({ max: 1 }));
    await database.query(
      'CREATE TEMP TABLE step3_transaction_test (value INTEGER NOT NULL)',
    );
  });

  afterEach(async () => {
    // Closing the session removes its TEMP table; no application schema is created.
    await database.onModuleDestroy();
  });

  it('commits related writes and returns the operation result', async () => {
    const value = await database.withTransaction(async () => {
      await database.query(
        'INSERT INTO step3_transaction_test (value) VALUES ($1)',
        [1],
      );
      await database.query(
        'INSERT INTO step3_transaction_test (value) VALUES ($1)',
        [2],
      );
      return 'saved';
    });

    expect(value).toBe('saved');
    const result = await database.query<{ value: number }>(
      'SELECT value FROM step3_transaction_test ORDER BY value',
    );
    expect(result.rows).toEqual([{ value: 1 }, { value: 2 }]);
  });

  it('rolls back all writes after an operation failure and releases the connection', async () => {
    const failure = new Error('Operation failed');
    await expect(
      database.withTransaction(async () => {
        await database.query(
          'INSERT INTO step3_transaction_test (value) VALUES ($1)',
          [1],
        );
        throw failure;
      }),
    ).rejects.toBe(failure);

    const result = await database.query(
      'SELECT value FROM step3_transaction_test',
    );
    expect(result.rows).toEqual([]);

    await database.withTransaction(async () => {
      await database.query(
        'INSERT INTO step3_transaction_test (value) VALUES ($1)',
        [2],
      );
    });
    const recovered = await database.query<{ value: number }>(
      'SELECT value FROM step3_transaction_test',
    );
    expect(recovered.rows).toEqual([{ value: 2 }]);
  });

  it('does not report success when a swallowed SQL error has aborted the transaction', async () => {
    await expect(
      database.withTransaction(async () => {
        await database.query(
          'INSERT INTO step3_transaction_test (value) VALUES ($1)',
          [1],
        );
        // Simulate a caller handling an SQL error without rethrowing it.
        await database
          .query('INSERT INTO step3_transaction_test (value) VALUES (NULL)')
          .catch(() => undefined);
      }),
    ).rejects.toThrow('The transaction could not be committed.');

    const result = await database.query(
      'SELECT value FROM step3_transaction_test',
    );
    expect(result.rows).toEqual([]);
  });

  it('rejects nested transactions before running the inner operation', async () => {
    let innerRan = false;
    await database.withTransaction(async () => {
      await expect(
        database.withTransaction(async () => {
          innerRan = true;
        }),
      ).rejects.toThrow('Nested transactions are not supported.');
      await database.query(
        'INSERT INTO step3_transaction_test (value) VALUES ($1)',
        [1],
      );
    });

    expect(innerRan).toBe(false);
    const result = await database.query<{ value: number }>(
      'SELECT value FROM step3_transaction_test',
    );
    expect(result.rows).toEqual([{ value: 1 }]);
  });

  it('keeps concurrent transactions on separate connections across asynchronous operations', async () => {
    const concurrent = new DatabaseService(createDatabasePool({ max: 2 }));
    let arrivals = 0;
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const timeout = setTimeout(() => releaseGate(), 2000);

    const operation = () =>
      concurrent.withTransaction(async () => {
        const first = await concurrent.query<{ pid: number }>(
          'SELECT pg_backend_pid() AS pid',
        );
        arrivals += 1;
        if (arrivals === 2) releaseGate();
        await gate;
        expect(arrivals).toBe(2);
        const second = await concurrent.query<{ pid: number }>(
          'SELECT pg_backend_pid() AS pid',
        );
        expect(second.rows[0].pid).toBe(first.rows[0].pid);
        return first.rows[0].pid;
      });

    try {
      const pids = await Promise.all([operation(), operation()]);
      expect(pids[0]).not.toBe(pids[1]);
    } finally {
      clearTimeout(timeout);
      releaseGate();
      await concurrent.onModuleDestroy();
    }
  });
});
