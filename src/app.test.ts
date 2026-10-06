import { buildApp } from './app';
import { openDb } from './db';

describe('app', () => {
  const app = buildApp({ db: openDb(':memory:') });

  afterAll(() => app.close());

  it('responds on /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
