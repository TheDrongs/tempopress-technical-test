import { testCookie, seedTestSessions } from './auth-test.helper.js';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Pool } from 'pg';
import sharp from 'sharp';
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
import {
  MAX_PHOTO_BYTES,
  UPLOADS_DIRECTORY,
} from '../src/modules/sparepart-requests/photos/photo.constants.js';
import { SparepartPhotoStorage } from '../src/modules/sparepart-requests/photos/sparepart-photo.storage.js';

interface ItemInput {
  name: string;
  qty: number;
  photoKey?: string;
}
interface PhotoInput {
  key: string;
  buffer: Buffer;
  type?: string;
}
interface ItemResponse {
  id: string;
  name: string;
  qty: number;
  imagePath: string | null;
  imageUrl: string | null;
}

describe('Optional sparepart photos (HTTP, PostgreSQL, and filesystem)', () => {
  let app: INestApplication<App>;
  let adminPool: Pool;
  let database: DatabaseService;
  let schema: string;
  let directory: string;
  let png: Buffer;
  let jpeg: Buffer;
  const [adminId, spvId, mechanicId] = DEMO_USERS.map((user) => user.id);

  beforeAll(async () => {
    png = await sharp({
      create: { width: 8, height: 6, channels: 3, background: '#cc3311' },
    })
      .png()
      .toBuffer();
    jpeg = await sharp({
      create: { width: 10, height: 7, channels: 3, background: '#2266bb' },
    })
      .jpeg()
      .toBuffer();
  });

  async function openApp() {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE_POOL)
      .useValue(
        createDatabasePool({ max: 5, options: `-c search_path=${schema}` }),
      )
      .overrideProvider(UPLOADS_DIRECTORY)
      .useValue(directory)
      .compile();
    app = fixture.createNestApplication({ logger: false });
    configureApplication(app);
    database = app.get(DatabaseService);
    await app.init();
  }

  beforeEach(async () => {
    schema = `photos_test_${randomUUID().replaceAll('-', '')}`;
    directory = await mkdtemp(join(tmpdir(), 'tempopress-photo-test-'));
    adminPool = createDatabasePool({ max: 1 });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    await openApp();
    await runMigrations(database);
    await seedDemoUsers(database);
    await seedTestSessions(database);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await app?.close();
      if (!/^photos_test_[a-f0-9]{32}$/.test(schema))
        throw new Error('Unexpected test schema.');
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      const target = resolve(directory);
      if (
        dirname(target) !== resolve(tmpdir()) ||
        !basename(target).startsWith('tempopress-photo-test-')
      ) {
        throw new Error('Unexpected upload test directory.');
      }
      await rm(target, { recursive: true, force: true });
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

  async function order(assigned = true): Promise<string> {
    const created = await post('/work-orders', adminId, {
      title: 'Photo test repair',
    }).expect(201);
    const id = created.body.id as string;
    if (assigned) {
      await post(`/work-orders/${id}/submit`).expect(200);
      await post(`/work-orders/${id}/assign`, spvId, { mechanicId }).expect(
        200,
      );
    }
    return id;
  }

  function upload(
    id: string,
    items: ItemInput[],
    photos: PhotoInput[] = [],
    actor = adminId,
  ) {
    let req = request(app.getHttpServer())
      .post(`/api/work-orders/${id}/request-sparepart`)
      .set('Cookie', testCookie(actor))
      .field('items', JSON.stringify(items));
    for (const photo of photos) {
      req = req.attach(`photos.${photo.key}`, photo.buffer, {
        filename: 'original-name.png',
        contentType: photo.type ?? 'image/png',
      });
    }
    return req;
  }

  async function storedFiles() {
    try {
      return await readdir(join(directory, 'spareparts'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  async function expectUnchanged(id: string) {
    const result = await database.query(
      'SELECT status FROM work_orders WHERE id = $1',
      [id],
    );
    expect(result.rows[0].status).toBe('ASSIGNED');
    expect(
      (await database.query('SELECT id FROM sparepart_requests')).rows,
    ).toEqual([]);
    expect(await storedFiles()).toEqual([]);
  }

  it('accepts JSON and multipart without photos, returning null references', async () => {
    const first = await order();
    const json = await post(
      `/work-orders/${first}/request-sparepart`,
      adminId,
      {
        items: [{ name: 'Pad', qty: 2 }],
      },
    ).expect(201);
    expect(json.body.sparepartRequest.items[0]).toMatchObject({
      imagePath: null,
      imageUrl: null,
    });
    const second = await order();
    const multipart = await upload(second, [{ name: 'Fluid', qty: 1 }]).expect(
      201,
    );
    expect(multipart.body.sparepartRequest.items[0]).toMatchObject({
      imagePath: null,
      imageUrl: null,
    });
    expect(await storedFiles()).toEqual([]);
  });

  it('maps reordered JPG/PNG files to their items and serves previews through stable URLs', async () => {
    const id = await order();
    const created = await upload(
      id,
      [
        { name: 'Fluid without photo', qty: 1 },
        { name: 'Pad', qty: 2, photoKey: 'pad_7' },
        { name: 'Filter', qty: 1, photoKey: 'filter_2' },
      ],
      [
        { key: 'filter_2', buffer: jpeg, type: 'image/jpeg' },
        { key: 'pad_7', buffer: png },
      ],
    )
      .field('title', 'Reviewed with photos')
      .expect(201);
    expect(created.body.workOrder).toMatchObject({
      title: 'Reviewed with photos',
      status: 'WAITING_SPAREPART_APPROVAL',
    });
    const items = created.body.sparepartRequest.items as ItemResponse[];
    const pad = items.find((item) => item.name === 'Pad')!;
    const filter = items.find((item) => item.name === 'Filter')!;
    expect(
      items.find((item) => item.name === 'Fluid without photo'),
    ).toMatchObject({ imagePath: null, imageUrl: null });
    expect(pad.imagePath).toMatch(/^spareparts\/[a-f0-9-]+\.png$/);
    expect(filter.imagePath).toMatch(/^spareparts\/[a-f0-9-]+\.jpg$/);
    expect(pad.imageUrl).toBe(`/api/sparepart-items/${pad.id}/image`);
    for (const [item, format, width] of [
      [pad, 'png', 8],
      [filter, 'jpeg', 10],
    ] as const) {
      const image = await request(app.getHttpServer())
        .get(item.imageUrl!)
        .set('Cookie', testCookie(adminId))
        .expect(200);
      expect(image.headers['content-type']).toBe(`image/${format}`);
      expect(image.headers['x-content-type-options']).toBe('nosniff');
      expect((await sharp(image.body as Buffer).metadata()).width).toBe(width);
    }
    const requestId = created.body.sparepartRequest.id as string;
    const approval = await post(
      `/sparepart-requests/${requestId}/approve`,
      spvId,
    ).expect(200);
    expect(
      approval.body.sparepartRequest.items.find(
        (item: ItemResponse) => item.id === pad.id,
      ).imageUrl,
    ).toBe(pad.imageUrl);
    const detail = await request(app.getHttpServer())
      .get(`/api/work-orders/${id}`)
      .set('Cookie', testCookie(spvId))
      .expect(200);
    expect(detail.body.sparepartRequests[0].items).toHaveLength(3);
    expect(await storedFiles()).toHaveLength(2);
  });

  it('rejects malformed items, unknown fields, and client-controlled storage paths', async () => {
    const id = await order();
    for (const items of [
      '{broken',
      '{}',
      '[null]',
      '[{"name":"Pad","qty":"2"}]',
    ]) {
      await request(app.getHttpServer())
        .post(`/api/work-orders/${id}/request-sparepart`)
        .set('Cookie', testCookie(adminId))
        .field('items', items)
        .expect(400);
    }
    await upload(id, [{ name: 'Pad', qty: 1 }])
      .field('imagePath', '../file.png')
      .expect(400);
    await post(`/work-orders/${id}/request-sparepart`, adminId, {
      items: [{ name: 'Pad', qty: 1, imagePath: 'spareparts/stolen.png' }],
    }).expect(400);
    await expectUnchanged(id);
  });

  it('rejects missing, unused, duplicate, and invalid photo mappings', async () => {
    const id = await order();
    const pad = { name: 'Pad', qty: 1, photoKey: 'pad' };
    await upload(id, [pad]).expect(400);
    await upload(
      id,
      [{ name: 'Fluid', qty: 1 }],
      [{ key: 'pad', buffer: png }],
    ).expect(400);
    await upload(
      id,
      [pad, { ...pad, name: 'Other' }],
      [{ key: 'pad', buffer: png }],
    ).expect(400);
    await upload(
      id,
      [pad],
      [
        { key: 'pad', buffer: png },
        { key: 'pad', buffer: png },
      ],
    ).expect(400);
    await upload(id, [{ ...pad, photoKey: '../unsafe' }]).expect(400);
    await upload(id, [pad], [{ key: '../unsafe', buffer: png }]).expect(400);
    await post(`/work-orders/${id}/request-sparepart`, adminId, {
      items: [pad],
    }).expect(400);
    await expectUnchanged(id);
  });

  it('checks actual image content and refuses spoofed, corrupt, and unsupported files', async () => {
    const id = await order();
    const items = [{ name: 'Pad', qty: 1, photoKey: 'pad' }];
    await upload(id, items, [
      { key: 'pad', buffer: Buffer.from('<script>invalid</script>') },
    ]).expect(400);
    await upload(id, items, [
      { key: 'pad', buffer: png.subarray(0, 40) },
    ]).expect(400);
    await upload(id, items, [{ key: 'pad', buffer: jpeg }]).expect(400);
    await upload(id, items, [
      { key: 'pad', buffer: png, type: 'image/svg+xml' },
    ]).expect(400);
    await expectUnchanged(id);
  });

  it('enforces the per-file size and per-request photo count limits', async () => {
    const id = await order();
    await upload(
      id,
      [{ name: 'Pad', qty: 1, photoKey: 'pad' }],
      [{ key: 'pad', buffer: Buffer.alloc(MAX_PHOTO_BYTES + 1) }],
    ).expect(413);
    const items = Array.from({ length: 11 }, (_, i) => ({
      name: `Pad ${i}`,
      qty: 1,
      photoKey: `pad${i}`,
    }));
    await upload(
      id,
      items,
      items.map((item) => ({ key: item.photoKey, buffer: png })),
    ).expect(400);
    await expectUnchanged(id);
  });

  it('rejects uploads by other roles or in the wrong workflow status without storing files', async () => {
    const id = await order();
    const items = [{ name: 'Pad', qty: 1, photoKey: 'pad' }];
    const photos = [{ key: 'pad', buffer: png }];
    await upload(id, items, photos, spvId).expect(403);
    await upload(id, items, photos, mechanicId).expect(403);
    await expectUnchanged(id);
    const draft = await order(false);
    await upload(draft, items, photos).expect(409);
    expect(await storedFiles()).toEqual([]);
    const created = await upload(id, items, photos).expect(201);
    await upload(id, items, photos).expect(409);
    await post(
      `/sparepart-requests/${created.body.sparepartRequest.id as string}/approve`,
      spvId,
    ).expect(200);
    await upload(id, items, photos).expect(409);
    expect(await storedFiles()).toHaveLength(1);
  });

  it('keeps one request and one photo for concurrent duplicate submissions', async () => {
    const id = await order();
    const items = [{ name: 'Pad', qty: 1, photoKey: 'pad' }];
    const photos = [{ key: 'pad', buffer: png }];
    const results = await Promise.all([
      upload(id, items, photos),
      upload(id, items, photos),
    ]);
    expect(
      results.map((result) => result.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);
    expect(
      (await database.query('SELECT id FROM sparepart_requests')).rows,
    ).toHaveLength(1);
    expect(await storedFiles()).toHaveLength(1);
  });

  it('cleans up files and rolls back all database changes when item persistence fails', async () => {
    const id = await order();
    await database.query(`
      CREATE FUNCTION reject_photo_item() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Photo persistence failure'; END $$;
      CREATE TRIGGER reject_photo_item BEFORE INSERT ON sparepart_items
      FOR EACH ROW EXECUTE FUNCTION reject_photo_item();
    `);
    const result = await upload(
      id,
      [{ name: 'Pad', qty: 1, photoKey: 'pad' }],
      [{ key: 'pad', buffer: png }],
    ).expect(500);
    expect(JSON.stringify(result.body)).not.toContain(
      'Photo persistence failure',
    );
    await expectUnchanged(id);
  });

  it('cleans up previously saved photos if a later storage write fails', async () => {
    const id = await order();
    const storage = app.get(SparepartPhotoStorage);
    const save = storage.save.bind(storage);
    vi.spyOn(storage, 'save')
      .mockImplementationOnce(save)
      .mockRejectedValueOnce(new Error('Disk full'));
    await upload(
      id,
      [
        { name: 'Pad', qty: 1, photoKey: 'pad' },
        { name: 'Filter', qty: 1, photoKey: 'filter' },
      ],
      [
        { key: 'pad', buffer: png },
        { key: 'filter', buffer: jpeg, type: 'image/jpeg' },
      ],
    ).expect(500);
    await expectUnchanged(id);
  });

  it('applies text limits to multipart metadata and preserves preparation on rejection', async () => {
    const id = await order();
    await upload(id, [{ name: 'n'.repeat(31), qty: 1 }]).expect(400);
    await upload(id, [{ name: 'Pad', qty: 1 }])
      .field('title', 't'.repeat(51))
      .expect(400);
    await upload(id, [{ name: 'Pad', qty: 1 }])
      .field('description', 'd'.repeat(101))
      .expect(400);
    await expectUnchanged(id);
    await upload(id, [{ name: 'n'.repeat(30), qty: 1 }])
      .field('title', 't'.repeat(50))
      .field('description', 'd'.repeat(100))
      .expect(201);
  });

  it('requires a session and enforces parent WO ownership for image reads', async () => {
    const id = await order();
    const created = await upload(
      id,
      [{ name: 'Pad', qty: 1, photoKey: 'pad' }],
      [{ key: 'pad', buffer: png }],
    ).expect(201);
    const url = created.body.sparepartRequest.items[0].imageUrl as string;
    await request(app.getHttpServer()).get(url).expect(401);
    for (const actor of [adminId, spvId, mechanicId])
      await request(app.getHttpServer())
        .get(url)
        .set('Cookie', testCookie(actor))
        .expect(200);
    const other = (
      await database.query<{ id: string }>(
        "INSERT INTO users (name, role) VALUES ('Unassigned SPV', 'SPV') RETURNING id",
      )
    ).rows[0].id;
    await seedTestSessions(database);
    await request(app.getHttpServer())
      .get(url)
      .set('Cookie', testCookie(other))
      .expect(404);
  });

  it('reads photos after the application restarts using the same storage directory', async () => {
    const id = await order();
    const created = await upload(
      id,
      [{ name: 'Pad', qty: 1, photoKey: 'pad' }],
      [{ key: 'pad', buffer: png }],
    ).expect(201);
    const item = created.body.sparepartRequest.items[0] as ItemResponse;
    await app.close();
    await openApp();
    await request(app.getHttpServer())
      .get(item.imageUrl!)
      .set('Cookie', testCookie(adminId))
      .expect(200);
    expect(await storedFiles()).toHaveLength(1);
  });

  it('returns 404 for missing photos and never serves arbitrary filesystem paths', async () => {
    const id = await order();
    const created = await upload(
      id,
      [
        { name: 'Pad', qty: 1, photoKey: 'pad' },
        { name: 'No photo', qty: 1 },
      ],
      [{ key: 'pad', buffer: png }],
    ).expect(201);
    const items = created.body.sparepartRequest.items as ItemResponse[];
    const photo = items.find((item) => item.imagePath)!;
    const noPhoto = items.find((item) => !item.imagePath)!;
    await request(app.getHttpServer())
      .get(`/api/sparepart-items/${noPhoto.id}/image`)
      .set('Cookie', testCookie(adminId))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/sparepart-items/${randomUUID()}/image`)
      .set('Cookie', testCookie(adminId))
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/sparepart-items/not-a-uuid/image')
      .set('Cookie', testCookie(adminId))
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/uploads/${photo.imagePath!}`)
      .set('Cookie', testCookie(adminId))
      .expect(404);
    await unlink(join(directory, photo.imagePath!));
    await request(app.getHttpServer())
      .get(photo.imageUrl!)
      .set('Cookie', testCookie(adminId))
      .expect(404);
  });
});
