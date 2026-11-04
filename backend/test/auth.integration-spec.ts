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
import {
  DEMO_USERS,
  DEMO_ACCOUNTS,
  seedDemoUsers,
} from '../src/database/setup/seed.js';
import { SESSION_COOKIE, tokenHash } from '../src/modules/auth/auth.service.js';
import { hashPassword } from '../src/modules/auth/password.js';

describe('Authentication with PostgreSQL-backed sessions', () => {
  let adminPool: Pool;
  let app: INestApplication<App>;
  let database: DatabaseService;
  let schema: string;
  const [adminId, , mechanicId] = DEMO_USERS.map((user) => user.id);
  async function openApp() {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE_POOL)
      .useValue(
        createDatabasePool({ max: 5, options: `-c search_path=${schema}` }),
      )
      .compile();
    app = fixture.createNestApplication({ logger: false });
    configureApplication(app);
    database = app.get(DatabaseService);
    await app.init();
  }
  beforeEach(async () => {
    schema = `auth_test_${randomUUID().replaceAll('-', '')}`;
    adminPool = createDatabasePool({ max: 1 });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    await openApp();
    await runMigrations(database);
    await seedDemoUsers(database);
  });
  afterEach(async () => {
    await app?.close();
    if (!/^auth_test_[a-f0-9]{32}$/.test(schema))
      throw new Error('Unexpected auth test schema');
    try {
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await adminPool.end();
    }
  });
  function login(
    username = DEMO_ACCOUNTS.ADMIN.username,
    password = Object.values(DEMO_ACCOUNTS).find(
      (account) => account.username === username,
    )?.password ?? DEMO_ACCOUNTS.ADMIN.password,
  ) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password });
  }
  function cookie(response: { headers: Record<string, unknown> }) {
    const header = (response.headers['set-cookie'] as string[])[0];
    return header.split(';')[0];
  }
  function me(value: string) {
    return request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', value);
  }

  it('logs in with hashed credentials and issues an HttpOnly, SameSite cookie with an eight-hour database session', async () => {
    const response = await login(' ADMIN ').expect(200);
    expect(response.body).toEqual({
      id: adminId,
      name: 'Admin Demo',
      role: 'ADMIN',
    });
    const header = (response.headers['set-cookie'] as unknown as string[])[0];
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/api');
    expect(header).toContain('Max-Age=28800');
    const token = cookie(response).split('=')[1];
    const stored = (
      await database.query<{ token_hash: string; seconds: number }>(
        'SELECT token_hash, EXTRACT(EPOCH FROM (expires_at - NOW()))::int seconds FROM auth_sessions',
      )
    ).rows[0];
    expect(stored.token_hash).toBe(tokenHash(token));
    expect(stored.token_hash).not.toBe(token);
    expect(stored.seconds).toBeGreaterThan(28780);
    const credentials = (
      await database.query<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id = $1',
        [adminId],
      )
    ).rows[0];
    expect(credentials.password_hash).toMatch(/^scrypt\$/);
    expect(credentials.password_hash).not.toContain(
      DEMO_ACCOUNTS.ADMIN.password,
    );
    await me(cookie(response)).expect(200, response.body);
  });
  it('rejects wrong, unknown, malformed and forged-role login requests without creating sessions', async () => {
    await login(DEMO_ACCOUNTS.ADMIN.username, 'incorrect').expect(401);
    await login('unknown').expect(401);
    await login('').expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: DEMO_ACCOUNTS.ADMIN.username,
        password: DEMO_ACCOUNTS.ADMIN.password,
        role: 'ADMIN',
      })
      .expect(400);
    expect(
      (await database.query('SELECT * FROM auth_sessions')).rows,
    ).toHaveLength(0);
  });
  it('requires a session for all business APIs and ignores spoofed identity headers', async () => {
    for (const path of [
      '/api/users',
      '/api/work-orders',
      '/api/auth/me',
      `/api/sparepart-items/${randomUUID()}/image`,
    ])
      await request(app.getHttpServer())
        .get(path)
        .set('X-User-Id', adminId)
        .expect(401);
    const response = await login(DEMO_ACCOUNTS.MECHANIC.username).expect(200);
    await request(app.getHttpServer())
      .post('/api/work-orders')
      .set('Cookie', cookie(response))
      .set('X-User-Id', adminId)
      .send({ title: 'Spoofed admin' })
      .expect(403);
    await me(`${SESSION_COOKIE}=${'a'.repeat(64)}`).expect(401);
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });
  it('revokes sessions on logout and clears the cookie', async () => {
    const value = cookie(await login().expect(200));
    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', value)
      .expect(204);
    expect(String(response.headers['set-cookie'])).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
    await me(value).expect(401);
    expect(
      (await database.query('SELECT * FROM auth_sessions')).rows,
    ).toHaveLength(0);
  });
  it('rejects expired sessions and reads the current role from the database', async () => {
    const value = cookie(await login().expect(200));
    await database.query("UPDATE users SET role = 'MECHANIC' WHERE id = $1", [
      adminId,
    ]);
    expect((await me(value).expect(200)).body.role).toBe('MECHANIC');
    await database.query(
      "UPDATE auth_sessions SET created_at = NOW() - INTERVAL '2 days', expires_at = NOW() - INTERVAL '1 day'",
    );
    await me(value).expect(401);
  });
  it('rotates an existing login session and keeps the new session across application restarts', async () => {
    const old = cookie(await login().expect(200));
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Cookie', old)
      .send({
        username: DEMO_ACCOUNTS.ADMIN.username,
        password: DEMO_ACCOUNTS.ADMIN.password,
      })
      .expect(200);
    await me(old).expect(401);
    const next = cookie(response);
    expect(next).not.toBe(old);
    await app.close();
    await openApp();
    await me(next).expect(200);
  });
  it('blocks cross-origin login/logout and cross-site state changes', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', 'https://other.example')
      .send({
        username: DEMO_ACCOUNTS.ADMIN.username,
        password: DEMO_ACCOUNTS.ADMIN.password,
      })
      .expect(403);
    const value = cookie(await login().expect(200));
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', value)
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(403);
    await me(value).expect(200);
  });
  it('keeps the old session active when a role switch has a wrong password or mismatched role', async () => {
    const old = cookie(await login().expect(200));
    const postSwitch = (
      username: string,
      password: string,
      expectedRole: string,
    ) =>
      request(app.getHttpServer())
        .post('/api/auth/switch')
        .set('Cookie', old)
        .send({ username, password, expectedRole });
    await postSwitch('spv', 'wrong', 'SPV').expect(401);
    await me(old).expect(200);
    await postSwitch('admin', 'admin123', 'SPV').expect(403);
    await me(old).expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/switch')
      .set('Cookie', old)
      .send({ username: 'spv', password: 'spv123' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/switch')
      .send({ username: 'spv', password: 'spv123', expectedRole: 'SPV' })
      .expect(401);
    expect(
      (await database.query('SELECT * FROM auth_sessions')).rows,
    ).toHaveLength(1);
  });
  it('replaces the old session only after credentials and the target role are verified', async () => {
    const old = cookie(await login().expect(200));
    const response = await request(app.getHttpServer())
      .post('/api/auth/switch')
      .set('Cookie', old)
      .send({ username: 'spv', password: 'spv123', expectedRole: 'SPV' })
      .expect(200);
    expect(response.body.role).toBe('SPV');
    await me(old).expect(401);
    await me(cookie(response)).expect(200, response.body);
    expect(
      (await database.query('SELECT * FROM auth_sessions')).rows,
    ).toHaveLength(1);
  });
  it('rolls back old-session revocation if saving the replacement session fails', async () => {
    const old = cookie(await login().expect(200));
    await database.query(`CREATE FUNCTION reject_session_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture insert failure'; END $$;
      CREATE TRIGGER reject_session_insert BEFORE INSERT ON auth_sessions FOR EACH ROW EXECUTE FUNCTION reject_session_insert()`);
    await request(app.getHttpServer())
      .post('/api/auth/switch')
      .set('Cookie', old)
      .send({ username: 'spv', password: 'spv123', expectedRole: 'SPV' })
      .expect(500);
    expect((await me(old).expect(200)).body.role).toBe('ADMIN');
    expect(
      (await database.query('SELECT * FROM auth_sessions')).rows,
    ).toHaveLength(1);
  });
  it('allows only one replacement when the same old session is switched concurrently', async () => {
    const old = cookie(await login().expect(200));
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/auth/switch')
        .set('Cookie', old)
        .send({ username: 'spv', password: 'spv123', expectedRole: 'SPV' });
    const responses = await Promise.all([attempt(), attempt()]);
    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([
      200, 401,
    ]);
    expect(
      (await database.query('SELECT * FROM auth_sessions')).rows,
    ).toHaveLength(1);
  });

  it('seeds credentials idempotently without overwriting a changed password or username', async () => {
    const next = await hashPassword('ChangedPassword123!');
    await database.query(
      'UPDATE users SET username = $1, password_hash = $2 WHERE id = $3',
      ['changed-mechanic', next, mechanicId],
    );
    expect(await seedDemoUsers(database)).toBe(0);
    await login('changed-mechanic', 'ChangedPassword123!').expect(200);
    await login(DEMO_ACCOUNTS.MECHANIC.username).expect(401);
  });
});
