import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { SyncWorker } from '../src/sync/sync.worker.js';

export async function createTestApp(): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  setupApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

export async function truncateAll(app: NestFastifyApplication): Promise<void> {
  await app.get(SyncWorker).idle();
  const dataSource = app.get(DataSource);
  const tables = dataSource.entityMetadatas.map(({ tablePath }) => `"${tablePath}"`).join(', ');
  await dataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}
