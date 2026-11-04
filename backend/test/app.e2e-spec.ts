import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { DatabaseService } from './../src/database/database.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let checkConnection: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    checkConnection = vi.fn().mockResolvedValue(undefined);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({ checkConnection })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /api/health returns the backend health response', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', service: 'backend', database: 'connected' });
  });

  it('GET /api/health returns 503 without exposing database errors', () => {
    checkConnection.mockRejectedValue(new Error('Private database error'));

    return request(app.getHttpServer())
      .get('/api/health')
      .expect(503)
      .expect({ status: 'error', service: 'backend', database: 'unavailable' });
  });

  afterEach(async () => {
    await app.close();
  });
});
