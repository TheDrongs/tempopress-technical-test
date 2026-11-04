import { randomUUID } from 'node:crypto';
import { copyFile, mkdtemp, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { createDatabasePool } from '../src/database/database.pool.js';
import { DatabaseService } from '../src/database/database.service.js';
import {
  MIGRATIONS_DIRECTORY,
  runMigrations,
} from '../src/database/setup/migrate.js';
import { DEMO_USERS, seedDemoUsers } from '../src/database/setup/seed.js';

describe('Work Order schema and setup (PostgreSQL integration)', () => {
  let admin: Pool;
  let database: DatabaseService;
  let schema: string;
  const adminId = DEMO_USERS[0].id;
  const spvId = DEMO_USERS[1].id;
  const mechanicId = DEMO_USERS[2].id;

  beforeEach(async () => {
    schema = `step4_test_${randomUUID().replaceAll('-', '')}`;
    admin = createDatabasePool({ max: 1 });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    database = new DatabaseService(
      createDatabasePool({
        max: 2,
        options: `-c search_path=${schema}`,
      }),
    );
  });

  afterEach(async () => {
    try {
      await database?.onModuleDestroy();
      // Only this test's generated namespace can be removed; public is never touched.
      if (!/^step4_test_[a-f0-9]{32}$/.test(schema)) {
        throw new Error('Refusing to remove an unexpected test schema.');
      }
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await admin?.end();
    }
  });

  async function setup() {
    await runMigrations(database);
    return seedDemoUsers(database);
  }

  async function createWorkOrder() {
    const result = await database.query<{ id: string }>(
      'INSERT INTO work_orders (title, created_by) VALUES ($1, $2) RETURNING id',
      ['Schema verification', adminId],
    );
    return result.rows[0].id;
  }

  async function createRequest(workOrderId: string) {
    const result = await database.query<{ id: string }>(
      'INSERT INTO sparepart_requests (work_order_id, requested_by) VALUES ($1, $2) RETURNING id',
      [workOrderId, adminId],
    );
    return result.rows[0].id;
  }

  it('creates the four business tables with authentication, 33 business columns, eight foreign keys, and migration history', async () => {
    const result = await runMigrations(database);
    expect(result.applied).toEqual([
      '001_create_work_order_schema.sql',
      '002_add_sparepart_item_image.sql',
      '003_add_work_order_supervisor.sql',
      '004_add_authentication.sql',
      '005_use_demo_usernames.sql',
    ]);

    const columns = await database.query<{ table_name: string; count: number }>(
      `SELECT table_name, COUNT(*)::integer AS count FROM information_schema.columns
       WHERE table_schema = $1 AND table_name <> '_schema_migrations'
       GROUP BY table_name ORDER BY table_name`,
      [schema],
    );
    expect(columns.rows).toEqual([
      { table_name: 'auth_sessions', count: 5 },
      { table_name: 'sparepart_items', count: 7 },
      { table_name: 'sparepart_requests', count: 8 },
      { table_name: 'users', count: 7 },
      { table_name: 'work_orders', count: 11 },
    ]);
    const foreignKeys = await database.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count FROM information_schema.table_constraints
       WHERE constraint_schema = $1 AND constraint_type = 'FOREIGN KEY'`,
      [schema],
    );
    expect(foreignKeys.rows[0].count).toBe(8);
    const timestamps = await database.query<{ data_type: string }>(
      `SELECT DISTINCT data_type FROM information_schema.columns
       WHERE table_schema = $1 AND column_name IN ('created_at', 'updated_at', 'start_date', 'end_date')`,
      [schema],
    );
    expect(timestamps.rows).toEqual([
      { data_type: 'timestamp with time zone' },
    ]);
  });

  it('can repeat migration and seed without duplicating or overwriting users', async () => {
    expect(await setup()).toBe(3);
    await database.query('UPDATE users SET name = $1 WHERE id = $2', [
      'Custom Admin Name',
      adminId,
    ]);
    await database.query('INSERT INTO users (name, role) VALUES ($1, $2)', [
      'Existing User',
      'MECHANIC',
    ]);

    const migration = await runMigrations(database);
    expect(migration.applied).toEqual([]);
    expect(migration.skipped).toEqual([
      '001_create_work_order_schema.sql',
      '002_add_sparepart_item_image.sql',
      '003_add_work_order_supervisor.sql',
      '004_add_authentication.sql',
      '005_use_demo_usernames.sql',
    ]);
    expect(await seedDemoUsers(database)).toBe(0);
    const users = await database.query<{ name: string }>(
      'SELECT name FROM users ORDER BY name',
    );
    expect(users.rows.map((user) => user.name)).toEqual([
      'Custom Admin Name',
      'Existing User',
      'Mechanic Demo',
      'SPV Demo',
    ]);
  });

  it('upgrades existing items without photos and rejects invalid storage paths', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tempopress-migration-'));
    const first = '001_create_work_order_schema.sql';
    try {
      await copyFile(join(MIGRATIONS_DIRECTORY, first), join(directory, first));
      await runMigrations(database, directory);
      await seedDemoUsers(database, false);
      const workOrderId = await createWorkOrder();
      const requestId = await createRequest(workOrderId);
      const item = await database.query<{ id: string }>(
        'INSERT INTO sparepart_items (sparepart_request_id, name, qty) VALUES ($1, $2, $3) RETURNING id',
        [requestId, 'Existing pad', 2],
      );
      const result = await runMigrations(database);
      expect(result.applied).toEqual([
        '002_add_sparepart_item_image.sql',
        '003_add_work_order_supervisor.sql',
        '004_add_authentication.sql',
        '005_use_demo_usernames.sql',
      ]);
      expect(
        (
          await database.query(
            'SELECT name, qty, image_path FROM sparepart_items',
          )
        ).rows,
      ).toEqual([{ name: 'Existing pad', qty: 2, image_path: null }]);
      await expect(
        database.query(
          'UPDATE sparepart_items SET image_path = $1 WHERE id = $2',
          ['../outside.png', item.rows[0].id],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    } finally {
      await unlink(join(directory, first));
      await rmdir(directory);
    }
  });

  it('serializes concurrent migration and seed runs', async () => {
    const migrations = await Promise.all([
      runMigrations(database),
      runMigrations(database),
    ]);
    expect(migrations.flatMap((result) => result.applied)).toHaveLength(5);
    const seeds = await Promise.all([
      seedDemoUsers(database),
      seedDemoUsers(database),
    ]);
    expect(seeds.sort((a, b) => a - b)).toEqual([0, 3]);
  });

  it('rejects a checksum mismatch instead of changing already migrated data', async () => {
    await setup();
    await database.query(
      "UPDATE _schema_migrations SET checksum = 'unexpected-checksum'",
    );
    await expect(runMigrations(database)).rejects.toThrow(
      'Applied migration was modified',
    );
    const users = await database.query('SELECT id FROM users');
    expect(users.rows).toHaveLength(3);
  });

  it('rolls back an unsuccessful migration and preserves pre-existing tables', async () => {
    await database.query('CREATE TABLE work_orders (id UUID PRIMARY KEY)');
    const existingId = randomUUID();
    await database.query('INSERT INTO work_orders (id) VALUES ($1)', [
      existingId,
    ]);
    await expect(runMigrations(database)).rejects.toMatchObject({
      code: '42P07',
    });
    const relations = await database.query<{
      users: string | null;
      history: string | null;
    }>(
      "SELECT to_regclass('users')::text AS users, to_regclass('_schema_migrations')::text AS history",
    );
    expect(relations.rows[0]).toEqual({ users: null, history: null });
    const existing = await database.query<{ id: string }>(
      'SELECT id FROM work_orders',
    );
    expect(existing.rows).toEqual([{ id: existingId }]);
  });

  it('stores nullable initial fields and a valid WO/request/item relationship', async () => {
    await setup();
    const workOrderId = await createWorkOrder();
    const workOrder = await database.query(
      'SELECT * FROM work_orders WHERE id = $1',
      [workOrderId],
    );
    expect(workOrder.rows[0]).toMatchObject({
      status: 'DRAFT',
      description: null,
      assigned_mechanic_id: null,
      start_date: null,
      end_date: null,
      created_at: expect.any(Date),
      updated_at: expect.any(Date),
    });
    const requestId = await createRequest(workOrderId);
    const secondRequestId = await createRequest(workOrderId);
    expect(secondRequestId).not.toBe(requestId);
    const request = await database.query(
      'SELECT * FROM sparepart_requests WHERE id = $1',
      [requestId],
    );
    expect(request.rows[0]).toMatchObject({
      status: 'PENDING',
      approved_by: null,
      approval_note: null,
    });
    await database.query(
      'UPDATE work_orders SET assigned_mechanic_id = $1, status = $2, updated_at = NOW() WHERE id = $3',
      [mechanicId, 'ASSIGNED', workOrderId],
    );
    await database.query(
      'UPDATE sparepart_requests SET approved_by = $1, status = $2, updated_at = NOW() WHERE id = $3',
      [spvId, 'APPROVED', requestId],
    );
    const item = await database.query(
      'INSERT INTO sparepart_items (sparepart_request_id, name, qty) VALUES ($1, $2, $3) RETURNING qty',
      [requestId, 'Brake pad', 2],
    );
    expect(item.rows[0].qty).toBe(2);
  });

  it('rejects invalid roles, statuses, blank names, and blank titles', async () => {
    await setup();
    const workOrderId = await createWorkOrder();
    const requestId = await createRequest(workOrderId);
    const cases: [string, unknown[]][] = [
      ['INSERT INTO users (name, role) VALUES ($1, $2)', ['User', 'OWNER']],
      ['INSERT INTO users (name, role) VALUES ($1, $2)', ['   ', 'ADMIN']],
      [
        'UPDATE work_orders SET status = $1 WHERE id = $2',
        ['UNKNOWN', workOrderId],
      ],
      ['UPDATE work_orders SET title = $1 WHERE id = $2', ['   ', workOrderId]],
      [
        'UPDATE sparepart_requests SET status = $1 WHERE id = $2',
        ['REJECTED', requestId],
      ],
      [
        'INSERT INTO sparepart_items (sparepart_request_id, name, qty) VALUES ($1, $2, $3)',
        [requestId, '   ', 1],
      ],
    ];
    for (const [sql, values] of cases) {
      await expect(database.query(sql, values)).rejects.toMatchObject({
        code: '23514',
      });
    }
  });

  it.each([false, true])(
    'preserves legacy WO data when adding supervisor ownership (multiple SPVs: %s)',
    async (multiple) => {
      const directory = await mkdtemp(
        join(tmpdir(), 'tempopress-supervisor-migration-'),
      );
      const files = [
        '001_create_work_order_schema.sql',
        '002_add_sparepart_item_image.sql',
      ];
      try {
        for (const file of files)
          await copyFile(
            join(MIGRATIONS_DIRECTORY, file),
            join(directory, file),
          );
        await runMigrations(database, directory);
        await seedDemoUsers(database, false);
        if (multiple)
          await database.query(
            "INSERT INTO users (name, role) VALUES ('Other SPV', 'SPV')",
          );
        const draft = await createWorkOrder();
        const working = await createWorkOrder();
        const start = new Date('2026-11-04T00:00:00Z');
        await database.query(
          "UPDATE work_orders SET status = 'WORKING', assigned_mechanic_id = $1, start_date = $2 WHERE id = $3",
          [mechanicId, start, working],
        );
        expect((await runMigrations(database)).applied).toEqual([
          '003_add_work_order_supervisor.sql',
          '004_add_authentication.sql',
          '005_use_demo_usernames.sql',
        ]);
        const records = await database.query(
          'SELECT id, title, status, start_date, assigned_spv_id FROM work_orders WHERE id = ANY($1::uuid[])',
          [[draft, working]],
        );
        expect(records.rows.find((row) => row.id === draft)).toMatchObject({
          status: 'DRAFT',
          assigned_spv_id: null,
        });
        expect(records.rows.find((row) => row.id === working)).toMatchObject({
          title: 'Schema verification',
          status: 'WORKING',
          start_date: start,
          assigned_spv_id: multiple ? null : spvId,
        });
      } finally {
        for (const file of files) await unlink(join(directory, file));
        await rmdir(directory);
      }
    },
  );

  it('rejects dangling references for all seven foreign keys', async () => {
    await setup();
    const workOrderId = await createWorkOrder();
    const missingId = randomUUID();
    const cases: [string, unknown[]][] = [
      [
        'UPDATE work_orders SET assigned_spv_id = $1 WHERE id = $2',
        [missingId, workOrderId],
      ],
      [
        'INSERT INTO work_orders (title, created_by) VALUES ($1, $2)',
        ['Invalid creator', missingId],
      ],
      [
        'UPDATE work_orders SET assigned_mechanic_id = $1 WHERE id = $2',
        [missingId, workOrderId],
      ],
      [
        'INSERT INTO sparepart_requests (work_order_id, requested_by) VALUES ($1, $2)',
        [missingId, adminId],
      ],
      [
        'INSERT INTO sparepart_requests (work_order_id, requested_by) VALUES ($1, $2)',
        [workOrderId, missingId],
      ],
      [
        'INSERT INTO sparepart_requests (work_order_id, requested_by, approved_by) VALUES ($1, $2, $3)',
        [workOrderId, adminId, missingId],
      ],
      [
        'INSERT INTO sparepart_items (sparepart_request_id, name, qty) VALUES ($1, $2, $3)',
        [missingId, 'Brake pad', 1],
      ],
    ];
    for (const [sql, values] of cases) {
      await expect(database.query(sql, values)).rejects.toMatchObject({
        code: '23503',
      });
    }
  });

  it('protects referenced parent data from deletion', async () => {
    await setup();
    const workOrderId = await createWorkOrder();
    const requestId = await createRequest(workOrderId);
    await database.query(
      'INSERT INTO sparepart_items (sparepart_request_id, name, qty) VALUES ($1, $2, $3)',
      [requestId, 'Brake pad', 1],
    );
    for (const [table, id] of [
      ['users', adminId],
      ['work_orders', workOrderId],
      ['sparepart_requests', requestId],
    ]) {
      await expect(
        database.query(`DELETE FROM ${table} WHERE id = $1`, [id]),
      ).rejects.toMatchObject({ code: '23503' });
    }
  });

  it('rejects invalid quantities and dates in the wrong order', async () => {
    await setup();
    const workOrderId = await createWorkOrder();
    const requestId = await createRequest(workOrderId);
    for (const qty of [0, -1]) {
      await expect(
        database.query(
          'INSERT INTO sparepart_items (sparepart_request_id, name, qty) VALUES ($1, $2, $3)',
          [requestId, 'Brake pad', qty],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    }
    await expect(
      database.query(
        'INSERT INTO sparepart_items (sparepart_request_id, name, qty) VALUES ($1, $2, $3)',
        [requestId, 'Brake pad', 1.5],
      ),
    ).rejects.toMatchObject({ code: '22P02' });
    await expect(
      database.query(
        'UPDATE work_orders SET start_date = $1, end_date = $2 WHERE id = $3',
        ['2026-11-03T10:00:00Z', '2026-11-03T09:00:00Z', workOrderId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
