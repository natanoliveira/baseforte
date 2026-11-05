import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

describe('health', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(() => app.close());
  it('GET /api/v1/health 200', () => request(app.getHttpServer()).get('/api/v1/health').expect(200).expect({ status: 'ok' }));
  it('rota inexistente usa erro padrão', async () => {
    const r = await request(app.getHttpServer()).get('/api/v1/nada').expect(404);
    expect(r.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });
});
