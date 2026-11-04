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

interface OrderResponse {
  id: string;
  status: string;
  title: string;
  description: string | null;
  assignedMechanicId: string | null;
  startDate: string | null;
  endDate: string | null;
}

describe('Work Order API workflow (PostgreSQL integration)', () => {
  let adminPool: Pool;
  let app: INestApplication<App>;
  let database: DatabaseService;
  let schema: string;
  const [adminId, spvId, mechanicId] = DEMO_USERS.map((user) => user.id);
  const items = [
    { name: 'Brake pad', qty: 2 },
    { name: 'Brake fluid', qty: 1 },
  ];

  beforeEach(async () => {
    schema = `step5_test_${randomUUID().replaceAll('-', '')}`;
    adminPool = createDatabasePool({ max: 1 });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const pool = createDatabasePool({
      max: 5,
      options: `-c search_path=${schema}`,
    });
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE_POOL)
      .useValue(pool)
      .compile();
    app = fixture.createNestApplication({ logger: false });
    configureApplication(app);
    database = app.get(DatabaseService);
    await runMigrations(database);
    await seedDemoUsers(database);
    await seedTestSessions(database);
    await app.init();
  });

  afterEach(async () => {
    try {
      await app?.close();
      if (!/^step5_test_[a-f0-9]{32}$/.test(schema)) {
        throw new Error('Refusing to remove an unexpected test schema.');
      }
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await adminPool?.end();
    }
  });

  function post(path: string, actor = adminId, body: object = {}) {
    return request(app.getHttpServer())
      .post(`/api${path}`)
      .set('Cookie', testCookie(actor))
      .send(body);
  }

  function get(path: string, actor = adminId) {
    return request(app.getHttpServer())
      .get(`/api${path}`)
      .set('Cookie', testCookie(actor));
  }

  async function createOrder(): Promise<OrderResponse> {
    const response = await post('/work-orders', adminId, {
      title: '  Brake repair  ',
    }).expect(201);
    return response.body as OrderResponse;
  }

  async function assignedOrder(): Promise<OrderResponse> {
    const order = await createOrder();
    await post(`/work-orders/${order.id}/submit`).expect(200);
    const response = await post(`/work-orders/${order.id}/assign`, spvId, {
      mechanicId,
    }).expect(200);
    return response.body as OrderResponse;
  }

  async function readyOrder(): Promise<OrderResponse> {
    const order = await assignedOrder();
    const response = await post(`/work-orders/${order.id}/update`, adminId, {
      description: 'No spareparts needed',
    }).expect(200);
    return response.body as OrderResponse;
  }

  async function workingOrder(): Promise<OrderResponse> {
    const order = await readyOrder();
    const response = await post(
      `/work-orders/${order.id}/start`,
      mechanicId,
    ).expect(200);
    return response.body as OrderResponse;
  }

  it('lists demo users for a session and rejects missing or invalid sessions', async () => {
    const users = await request(app.getHttpServer())
      .get('/api/users')
      .set('Cookie', testCookie(adminId))
      .expect(200);
    expect(users.body).toEqual(DEMO_USERS.map((user) => ({ ...user })));
    await request(app.getHttpServer()).get('/api/work-orders').expect(401);
    await get('/work-orders', 'invalid-user').expect(401);
    await get('/work-orders', randomUUID()).expect(401);
    await get('/work-orders').expect(200, []);
  });

  it('completes the no-sparepart workflow and persists detail and actor names', async () => {
    const order = await createOrder();
    expect(order).toMatchObject({
      title: 'Brake repair',
      status: 'DRAFT',
      startDate: null,
      endDate: null,
    });
    await post(`/work-orders/${order.id}/submit`)
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('SUBMITTED');
      });
    await post(`/work-orders/${order.id}/assign`, spvId, { mechanicId }).expect(
      200,
    );
    await post(`/work-orders/${order.id}/update`, adminId, {
      title: 'Reviewed repair',
      description: 'Proceed without spareparts',
    })
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('READY_TO_WORK');
      });
    const started = await post(
      `/work-orders/${order.id}/start`,
      mechanicId,
    ).expect(200);
    const endDate = new Date(
      Date.parse(started.body.startDate) + 60000,
    ).toISOString();
    await post(`/work-orders/${order.id}/complete`, adminId, {
      endDate,
    }).expect(200);
    const detail = await get(`/work-orders/${order.id}`, mechanicId).expect(
      200,
    );
    expect(detail.body).toMatchObject({
      id: order.id,
      title: 'Reviewed repair',
      description: 'Proceed without spareparts',
      status: 'COMPLETED',
      endDate,
      createdByUser: { id: adminId, name: 'Admin Demo', role: 'ADMIN' },
      assignedMechanic: {
        id: mechanicId,
        name: 'Mechanic Demo',
        role: 'MECHANIC',
      },
      sparepartRequests: [],
    });
    const list = await get('/work-orders').expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].status).toBe('COMPLETED');
  });

  it('completes the sparepart workflow including atomic preparation, approval, and items', async () => {
    const order = await assignedOrder();
    const created = await post(
      `/work-orders/${order.id}/request-sparepart`,
      adminId,
      {
        title: 'Reviewed with spareparts',
        description: 'Replace pads',
        items,
      },
    ).expect(201);
    const requestId = created.body.sparepartRequest.id as string;
    expect(created.body.workOrder).toMatchObject({
      title: 'Reviewed with spareparts',
      status: 'WAITING_SPAREPART_APPROVAL',
    });
    expect(created.body.sparepartRequest.status).toBe('PENDING');
    expect(created.body.sparepartRequest.items).toHaveLength(2);
    await post(`/work-orders/${order.id}/start`, mechanicId).expect(409);
    const approval = await post(
      `/sparepart-requests/${requestId}/approve`,
      spvId,
      { approvalNote: 'Approved for repair' },
    ).expect(200);
    expect(approval.body.workOrder.status).toBe('READY_TO_WORK');
    expect(approval.body.sparepartRequest).toMatchObject({
      status: 'APPROVED',
      approvedBy: spvId,
      approvalNote: 'Approved for repair',
    });
    const started = await post(
      `/work-orders/${order.id}/start`,
      mechanicId,
    ).expect(200);
    await post(`/work-orders/${order.id}/complete`, adminId, {
      endDate: started.body.startDate,
    }).expect(200);
    const detail = await get(`/work-orders/${order.id}`).expect(200);
    expect(detail.body.status).toBe('COMPLETED');
    expect(detail.body.sparepartRequests[0]).toMatchObject({
      id: requestId,
      requestedByUser: { name: 'Admin Demo' },
      approvedByUser: { name: 'SPV Demo' },
    });
    expect(detail.body.sparepartRequests[0].items).toHaveLength(2);
  });

  it('rejects actions by the wrong role at every workflow stage', async () => {
    await post('/work-orders', spvId, { title: 'Forbidden' }).expect(403);
    const order = await createOrder();
    await post(`/work-orders/${order.id}/submit`, mechanicId).expect(403);
    await post(`/work-orders/${order.id}/submit`).expect(200);
    await post(`/work-orders/${order.id}/assign`, adminId, {
      mechanicId,
    }).expect(403);
    await post(`/work-orders/${order.id}/assign`, spvId, { mechanicId }).expect(
      200,
    );
    await post(`/work-orders/${order.id}/update`, spvId).expect(403);
    await post(`/work-orders/${order.id}/request-sparepart`, mechanicId, {
      items,
    }).expect(403);
    const created = await post(
      `/work-orders/${order.id}/request-sparepart`,
      adminId,
      { items },
    ).expect(201);
    const requestId = created.body.sparepartRequest.id as string;
    await post(`/sparepart-requests/${requestId}/approve`, adminId).expect(403);
    await post(`/sparepart-requests/${requestId}/approve`, spvId).expect(200);
    await post(`/work-orders/${order.id}/start`, adminId).expect(403);
    const started = await post(
      `/work-orders/${order.id}/start`,
      mechanicId,
    ).expect(200);
    await post(`/work-orders/${order.id}/complete`, spvId, {
      endDate: started.body.startDate,
    }).expect(403);
  });

  it('only assigns actual mechanics and only lets the assigned mechanic start', async () => {
    const order = await createOrder();
    await post(`/work-orders/${order.id}/submit`).expect(200);
    await post(`/work-orders/${order.id}/assign`, spvId, {
      mechanicId: adminId,
    }).expect(400);
    await post(`/work-orders/${order.id}/assign`, spvId, {
      mechanicId: randomUUID(),
    }).expect(404);
    await post(`/work-orders/${order.id}/assign`, spvId, { mechanicId }).expect(
      200,
    );
    await post(`/work-orders/${order.id}/update`).expect(200);
    const other = await database.query<{ id: string }>(
      "INSERT INTO users (name, role) VALUES ('Other mechanic', 'MECHANIC') RETURNING id",
    );
    await seedTestSessions(database);
    await post(`/work-orders/${order.id}/start`, other.rows[0].id).expect(403);
    await post(`/work-orders/${order.id}/start`, mechanicId).expect(200);
  });

  it('rejects skipped workflow stages and repeated actions', async () => {
    const order = await createOrder();
    await post(`/work-orders/${order.id}/assign`, spvId, { mechanicId }).expect(
      409,
    );
    await post(`/work-orders/${order.id}/update`).expect(409);
    await post(`/work-orders/${order.id}/request-sparepart`, adminId, {
      items,
    }).expect(409);
    await post(`/work-orders/${order.id}/start`, mechanicId).expect(409);
    await post(`/work-orders/${order.id}/complete`, adminId, {
      endDate: new Date().toISOString(),
    }).expect(409);
    await post(`/work-orders/${order.id}/submit`).expect(200);
    await post(`/work-orders/${order.id}/submit`).expect(409);
    await post(`/work-orders/${order.id}/assign`, spvId, { mechanicId }).expect(
      200,
    );
    await post(`/work-orders/${order.id}/assign`, spvId, { mechanicId }).expect(
      409,
    );
    await post(`/work-orders/${order.id}/update`).expect(200);
    await post(`/work-orders/${order.id}/update`).expect(409);
    const started = await post(
      `/work-orders/${order.id}/start`,
      mechanicId,
    ).expect(200);
    await post(`/work-orders/${order.id}/start`, mechanicId).expect(409);
    await post(`/work-orders/${order.id}/complete`, adminId, {
      endDate: started.body.startDate,
    }).expect(200);
    await post(`/work-orders/${order.id}/complete`, adminId, {
      endDate: started.body.startDate,
    }).expect(409);
    await post(`/work-orders/${order.id}/request-sparepart`, adminId, {
      items,
    }).expect(409);
  });

  it('validates DTO fields and refuses client-controlled status or actor fields', async () => {
    for (const body of [
      {},
      { title: 123 },
      { title: '   ' },
      { title: 'Repair', status: 'COMPLETED' },
      { title: 'Repair', createdBy: spvId },
      { title: 'Repair', role: 'SPV' },
    ]) {
      await post('/work-orders', adminId, body).expect(400);
    }
    const order = await assignedOrder();
    await post(`/work-orders/${order.id}/update`, adminId, {
      title: null,
    }).expect(400);
    await post(`/work-orders/${order.id}/update`, adminId, { items }).expect(
      400,
    );
    await post(`/work-orders/${order.id}/assign`, spvId, {
      mechanicId: 'bad-id',
    }).expect(400);
    const current = await get(`/work-orders/${order.id}`).expect(200);
    expect(current.body.status).toBe('ASSIGNED');
  });

  it('validates nested sparepart items before changing any data', async () => {
    const order = await assignedOrder();
    const invalidBodies = [
      {},
      { items: [] },
      { items: 'invalid' },
      { items: [null] },
      { items: [{ name: ' ', qty: 1 }] },
      { items: [{ name: 'Pad', qty: 0 }] },
      { items: [{ name: 'Pad', qty: -1 }] },
      { items: [{ name: 'Pad', qty: 1.5 }] },
      { items: [{ name: 'Pad', qty: 2_147_483_648 }] },
      { items: [{ name: 'Pad', qty: '1' }] },
      { items: [{ name: 'Pad', qty: 1, price: 10 }] },
    ];
    for (const body of invalidBodies) {
      await post(
        `/work-orders/${order.id}/request-sparepart`,
        adminId,
        body,
      ).expect(400);
    }
    expect(
      (await database.query('SELECT id FROM sparepart_requests')).rows,
    ).toEqual([]);
    expect((await get(`/work-orders/${order.id}`)).body.status).toBe(
      'ASSIGNED',
    );
  });

  it('validates UUID paths and reports missing resources', async () => {
    await get('/work-orders/invalid-id').expect(400);
    await get(`/work-orders/${randomUUID()}`).expect(404);
    await post(`/work-orders/${randomUUID()}/submit`).expect(404);
    await post(`/sparepart-requests/${randomUUID()}/approve`, spvId).expect(
      404,
    );
  });

  it('requires a timezone and rejects end dates earlier than the recorded start', async () => {
    const order = await workingOrder();
    for (const endDate of ['invalid', '2026-11-03', '2026-11-03T10:00:00']) {
      await post(`/work-orders/${order.id}/complete`, adminId, {
        endDate,
      }).expect(400);
    }
    const beforeStart = new Date(
      Date.parse(order.startDate!) - 1000,
    ).toISOString();
    await post(`/work-orders/${order.id}/complete`, adminId, {
      endDate: beforeStart,
    }).expect(400);
    expect((await get(`/work-orders/${order.id}`)).body.status).toBe('WORKING');
  });

  it('processes concurrent submit and start actions once each', async () => {
    const order = await createOrder();
    const submits = await Promise.all([
      post(`/work-orders/${order.id}/submit`),
      post(`/work-orders/${order.id}/submit`),
    ]);
    expect(
      submits.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([200, 409]);
    await post(`/work-orders/${order.id}/assign`, spvId, { mechanicId }).expect(
      200,
    );
    await post(`/work-orders/${order.id}/update`).expect(200);
    const starts = await Promise.all([
      post(`/work-orders/${order.id}/start`, mechanicId),
      post(`/work-orders/${order.id}/start`, mechanicId),
    ]);
    expect(
      starts.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([200, 409]);
  });

  it('creates one request when duplicate preparation requests arrive together', async () => {
    const order = await assignedOrder();
    const responses = await Promise.all([
      post(`/work-orders/${order.id}/request-sparepart`, adminId, { items }),
      post(`/work-orders/${order.id}/request-sparepart`, adminId, { items }),
    ]);
    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);
    expect(
      (await database.query('SELECT id FROM sparepart_requests')).rows,
    ).toHaveLength(1);
    expect(
      (await database.query('SELECT id FROM sparepart_items')).rows,
    ).toHaveLength(2);
  });

  it('approves one request once when duplicate approvals arrive together', async () => {
    const order = await assignedOrder();
    const created = await post(
      `/work-orders/${order.id}/request-sparepart`,
      adminId,
      { items },
    ).expect(201);
    const id = created.body.sparepartRequest.id as string;
    const approvals = await Promise.all([
      post(`/sparepart-requests/${id}/approve`, spvId),
      post(`/sparepart-requests/${id}/approve`, spvId),
    ]);
    expect(
      approvals.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([200, 409]);
    expect((await get(`/work-orders/${order.id}`)).body.status).toBe(
      'READY_TO_WORK',
    );
  });

  it('waits for all pending requests and serializes approvals for the same WO', async () => {
    const order = await assignedOrder();
    const first = await post(
      `/work-orders/${order.id}/request-sparepart`,
      adminId,
      { items },
    ).expect(201);
    // The ERD permits multiple requests; prepare an additional pending request as fixture data.
    const extra = await database.query<{ id: string }>(
      'INSERT INTO sparepart_requests (work_order_id, requested_by) VALUES ($1, $2) RETURNING id',
      [order.id, adminId],
    );
    await database.query(
      'INSERT INTO sparepart_items (sparepart_request_id, name, qty) VALUES ($1, $2, $3)',
      [extra.rows[0].id, 'Additional item', 1],
    );
    const firstId = first.body.sparepartRequest.id as string;
    const responses = await Promise.all([
      post(`/sparepart-requests/${firstId}/approve`, spvId),
      post(`/sparepart-requests/${extra.rows[0].id}/approve`, spvId),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(
      responses
        .map((response) => response.body.workOrder.status as string)
        .sort((a, b) => a.localeCompare(b)),
    ).toEqual(['READY_TO_WORK', 'WAITING_SPAREPART_APPROVAL']);
    expect((await get(`/work-orders/${order.id}`)).body.status).toBe(
      'READY_TO_WORK',
    );
  });

  it('rolls back WO changes, request, and items when item persistence fails', async () => {
    const order = await assignedOrder();
    await database.query(`
      CREATE FUNCTION reject_test_item() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.name = 'Failure test' THEN RAISE EXCEPTION 'Forced test persistence failure'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER reject_test_item BEFORE INSERT ON sparepart_items
      FOR EACH ROW EXECUTE FUNCTION reject_test_item();
    `);
    const response = await post(
      `/work-orders/${order.id}/request-sparepart`,
      adminId,
      {
        title: 'Must roll back',
        items: [
          { name: 'Pad', qty: 1 },
          { name: 'Failure test', qty: 1 },
        ],
      },
    ).expect(500);
    expect(JSON.stringify(response.body)).not.toContain(
      'Forced test persistence failure',
    );
    const detail = await get(`/work-orders/${order.id}`).expect(200);
    expect(detail.body).toMatchObject({
      title: order.title,
      status: 'ASSIGNED',
      sparepartRequests: [],
    });
    expect(
      (await database.query('SELECT id FROM sparepart_items')).rows,
    ).toEqual([]);
  });

  it('enforces text limits at create, preparation and approval without partially changing status', async () => {
    await post('/work-orders', adminId, { title: 't'.repeat(51) }).expect(400);
    await post('/work-orders', adminId, {
      title: 'Valid',
      description: 'd'.repeat(101),
    }).expect(400);
    const created = await post('/work-orders', adminId, {
      title: 't'.repeat(50),
      description: 'd'.repeat(100),
    }).expect(201);
    const id = created.body.id as string;
    await post(`/work-orders/${id}/submit`).expect(200);
    await post(`/work-orders/${id}/assign`, spvId, { mechanicId }).expect(200);
    await post(`/work-orders/${id}/update`, adminId, {
      title: 't'.repeat(51),
    }).expect(400);
    await post(`/work-orders/${id}/update`, adminId, {
      description: 'd'.repeat(101),
    }).expect(400);
    await post(`/work-orders/${id}/request-sparepart`, adminId, {
      items: [{ name: 'n'.repeat(31), qty: 1 }],
    }).expect(400);
    expect((await get(`/work-orders/${id}`)).body.status).toBe('ASSIGNED');
    const prepared = await post(
      `/work-orders/${id}/request-sparepart`,
      adminId,
      {
        title: '😀'.repeat(50),
        description: 'd'.repeat(100),
        items: [{ name: 'n'.repeat(30), qty: 1 }],
      },
    ).expect(201);
    const requestId = prepared.body.sparepartRequest.id as string;
    await post(`/sparepart-requests/${requestId}/approve`, spvId, {
      approvalNote: 'a'.repeat(101),
    }).expect(400);
    expect((await get(`/work-orders/${id}`)).body.status).toBe(
      'WAITING_SPAREPART_APPROVAL',
    );
    await post(`/sparepart-requests/${requestId}/approve`, spvId, {
      approvalNote: 'a'.repeat(100),
    }).expect(200);
    const without = await assignedOrder();
    await post(`/work-orders/${without.id}/update`, adminId, {
      title: 't'.repeat(50),
      description: 'd'.repeat(100),
    }).expect(200);
  });

  it('stores SQL-like user text as data and permits clearing optional descriptions', async () => {
    const title = "Brake repair'); DROP TABLE users; --";
    const created = await post('/work-orders', adminId, {
      title,
      description: 'Initial note',
    }).expect(201);
    const id = created.body.id as string;
    await post(`/work-orders/${id}/submit`).expect(200);
    await post(`/work-orders/${id}/assign`, spvId, { mechanicId }).expect(200);
    const prepared = await post(`/work-orders/${id}/update`, adminId, {
      description: null,
    }).expect(200);
    expect(prepared.body).toMatchObject({ title, description: null });
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/users')
          .set('Cookie', testCookie(adminId))
      ).body,
    ).toHaveLength(3);
  });
});
