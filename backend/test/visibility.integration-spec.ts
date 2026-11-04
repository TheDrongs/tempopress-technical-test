import { testCookie, seedTestSessions } from './auth-test.helper.js';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Pool } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/configure-app.js';
import {
  createDatabasePool,
  DATABASE_POOL,
} from '../src/database/database.pool.js';
import { DatabaseService } from '../src/database/database.service.js';
import { runMigrations } from '../src/database/setup/migrate.js';
import { DEMO_USERS, seedDemoUsers } from '../src/database/setup/seed.js';

describe('Work Order visibility and supervisor ownership (real PostgreSQL)', () => {
  let adminPool: Pool;
  let app: INestApplication<App>;
  let database: DatabaseService;
  let schema: string;
  let otherSpv: string;
  let otherMechanic: string;
  const [adminId, spvId, mechanicId] = DEMO_USERS.map((user) => user.id);
  beforeEach(async () => {
    schema = `visibility_test_${randomUUID().replaceAll('-', '')}`;
    adminPool = createDatabasePool({ max: 1 });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE_POOL)
      .useValue(
        createDatabasePool({ max: 5, options: `-c search_path=${schema}` }),
      )
      .compile();
    app = fixture.createNestApplication({ logger: false });
    configureApplication(app);
    database = app.get(DatabaseService);
    await runMigrations(database);
    await seedDemoUsers(database);
    otherSpv = (
      await database.query<{ id: string }>(
        "INSERT INTO users (name, role) VALUES ('Other SPV', 'SPV') RETURNING id",
      )
    ).rows[0].id;
    otherMechanic = (
      await database.query<{ id: string }>(
        "INSERT INTO users (name, role) VALUES ('Other mechanic', 'MECHANIC') RETURNING id",
      )
    ).rows[0].id;
    await seedTestSessions(database);
    await app.init();
  });
  afterEach(async () => {
    try {
      await app?.close();
      if (!/^visibility_test_[a-f0-9]{32}$/.test(schema))
        throw new Error('Unexpected test schema.');
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await adminPool?.end();
    }
  });
  function get(path: string, actor: string) {
    return request(app.getHttpServer())
      .get(`/api${path}`)
      .set('Cookie', testCookie(actor));
  }
  function post(path: string, actor = adminId, body: object = {}) {
    return request(app.getHttpServer())
      .post(`/api${path}`)
      .set('Cookie', testCookie(actor))
      .send(body);
  }
  async function create() {
    return (
      await post('/work-orders', adminId, { title: 'Visibility test' }).expect(
        201,
      )
    ).body.id as string;
  }

  it('hides all drafts and filters submitted work by the actual recipient SPV', async () => {
    const draft = await create();
    const first = await create();
    const second = await create();
    await post(`/work-orders/${first}/submit`, adminId, { spvId }).expect(200);
    await post(`/work-orders/${second}/submit`, adminId, {
      spvId: otherSpv,
    }).expect(200);
    expect((await get('/work-orders', adminId)).body).toHaveLength(3);
    const firstList = (await get('/work-orders', spvId)).body as {
      id: string;
    }[];
    const secondList = (await get('/work-orders', otherSpv)).body as {
      id: string;
    }[];
    expect(firstList.map((row) => row.id)).toEqual([first]);
    expect(secondList.map((row) => row.id)).toEqual([second]);
    await get('/work-orders', mechanicId).expect(200, []);
    for (const actor of [spvId, otherSpv, mechanicId, otherMechanic])
      await get(`/work-orders/${draft}`, actor).expect(404);
    await get(`/work-orders/${first}`, otherSpv).expect(404);
    await get(`/work-orders/${second}`, spvId).expect(404);
    const detail = await get(`/work-orders/${first}`, spvId).expect(200);
    expect(detail.body.assignedSpv).toMatchObject({ id: spvId, role: 'SPV' });
  });

  it('requires the intended SPV for assignment and approval and only exposes work to its mechanic', async () => {
    const id = await create();
    await post(`/work-orders/${id}/submit`, adminId, { spvId }).expect(200);
    await post(`/work-orders/${id}/assign`, otherSpv, { mechanicId }).expect(
      403,
    );
    await post(`/work-orders/${id}/assign`, spvId, { mechanicId }).expect(200);
    await get(`/work-orders/${id}`, mechanicId).expect(200);
    await get(`/work-orders/${id}`, otherMechanic).expect(404);
    await get('/work-orders', otherMechanic).expect(200, []);
    const created = await post(
      `/work-orders/${id}/request-sparepart`,
      adminId,
      { items: [{ name: 'Pad', qty: 2 }] },
    ).expect(201);
    const requestId = created.body.sparepartRequest.id as string;
    await post(`/sparepart-requests/${requestId}/approve`, otherSpv).expect(
      403,
    );
    expect((await get(`/work-orders/${id}`, adminId)).body.status).toBe(
      'WAITING_SPAREPART_APPROVAL',
    );
    await post(`/sparepart-requests/${requestId}/approve`, spvId).expect(200);
    await post(`/work-orders/${id}/start`, otherMechanic).expect(403);
    const started = await post(`/work-orders/${id}/start`, mechanicId).expect(
      200,
    );
    await post(`/work-orders/${id}/complete`, adminId, {
      endDate: started.body.startDate,
    }).expect(200);
    expect((await get('/work-orders', mechanicId)).body).toHaveLength(1);
    expect((await get('/work-orders', spvId)).body).toHaveLength(1);
    await get('/work-orders', otherSpv).expect(200, []);
    await get(`/work-orders/${id}`, otherSpv).expect(404);
  });

  it('validates the SPV recipient and keeps the draft unchanged on invalid submission', async () => {
    const id = await create();
    await post(`/work-orders/${id}/submit`).expect(400);
    await post(`/work-orders/${id}/submit`, adminId, { spvId: adminId }).expect(
      400,
    );
    await post(`/work-orders/${id}/submit`, adminId, {
      spvId: randomUUID(),
    }).expect(404);
    await post(`/work-orders/${id}/submit`, adminId, {
      spvId: 'invalid',
    }).expect(400);
    await post(`/work-orders/${id}/submit`, adminId, {
      spvId,
      status: 'COMPLETED',
    }).expect(400);
    expect((await get(`/work-orders/${id}`, adminId)).body).toMatchObject({
      status: 'DRAFT',
      assignedSpvId: null,
    });
  });

  it('keeps a draft hidden even if assignment IDs exist in a legacy or manually edited row', async () => {
    const id = await create();
    await database.query(
      'UPDATE work_orders SET assigned_spv_id = $1, assigned_mechanic_id = $2 WHERE id = $3',
      [spvId, mechanicId, id],
    );
    await get('/work-orders', spvId).expect(200, []);
    await get('/work-orders', mechanicId).expect(200, []);
    await get(`/work-orders/${id}`, spvId).expect(404);
    await get(`/work-orders/${id}`, mechanicId).expect(404);
    await get(`/work-orders/${id}`, adminId).expect(200);
  });
});
