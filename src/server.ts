import { buildApp } from './app';
import { DB_PATH, openDb } from './db';

const app = buildApp({ logger: true, db: openDb(DB_PATH) });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
