import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from '../test/create-test-app.js';

let app: NestFastifyApplication;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(() => app.close());

describe('app', () => {
  it('responds on /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
