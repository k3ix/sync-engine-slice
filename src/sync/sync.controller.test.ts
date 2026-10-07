import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DataSource } from 'typeorm';
import { createTestApp, truncateAll } from '../../test/create-test-app.js';
import { Change } from './change.entity.js';
import type { ChangeInput } from './sync.types.js';
import { SyncWorker } from './sync.worker.js';

const T = Date.parse('2026-01-15T10:00:00.000Z');
const MAX_BATCH = 100;

let app: NestFastifyApplication;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(() => truncateAll(app));

afterAll(() => app.close());

const createProject = (): ChangeInput => ({
  model: 'projects',
  recordId: randomUUID(),
  action: 'create',
  data: { name: 'Sync engine', status: 'active' },
  clientTimestamp: T,
});

const push = (changes: unknown[]) =>
  app.inject({ method: 'POST', url: '/sync/changes', payload: { changes } });

const countChanges = () => app.get(DataSource).getRepository(Change).count();

describe('POST /sync/changes', () => {
  it('applies pushed changes in the background', async () => {
    const change = createProject();

    const res = await push([change]);
    await app.get(SyncWorker).idle();
    const found = await app.inject({ method: 'GET', url: `/projects/${change.recordId}` });

    expect(res.statusCode).toBe(202);
    expect(found.json()).toMatchObject({ id: change.recordId, name: 'Sync engine' });
  });

  it('gives concurrent pushes distinct consecutive sync ids', async () => {
    const batches = [[createProject()], [createProject()], [createProject()]];

    await Promise.all(batches.map((batch) => push(batch)));
    await app.get(SyncWorker).idle();

    const rows = await app
      .get(DataSource)
      .getRepository(Change)
      .find({ order: { syncId: 'ASC' } });
    expect(rows.map(({ status, syncId }) => [status, syncId])).toEqual([
      ['applied', 1],
      ['applied', 2],
      ['applied', 3],
    ]);
  });

  it('stores the batch and answers 202 with an empty body', async () => {
    const res = await push([createProject(), createProject()]);

    expect(res.statusCode).toBe(202);
    expect(res.body).toBe('');
    expect(await countChanges()).toBe(2);
  });

  it.each([
    ['an unknown model', { ...createProject(), model: 'users' }],
    [
      'a delete with data',
      {
        model: 'projects',
        recordId: randomUUID(),
        action: 'delete',
        data: { name: 'x' },
        clientTimestamp: T,
      },
    ],
    [
      'an update without data',
      { model: 'projects', recordId: randomUUID(), action: 'update', clientTimestamp: T },
    ],
    ['a create missing a field', { ...createProject(), data: { name: 'Q4' } }],
    ['an update with no fields', { ...createProject(), action: 'update', data: {} }],
    ['an update with a null field', { ...createProject(), action: 'update', data: { name: null } }],
    [
      'an unknown data field',
      { ...createProject(), data: { name: 'Q4', status: 'active', nope: 1 } },
    ],
    [
      'an invalid enum value',
      { ...createProject(), action: 'update', data: { status: 'sleeping' } },
    ],
    ['a record id that is not a uuid', { ...createProject(), recordId: 'abc' }],
    ['a missing timestamp', { ...createProject(), clientTimestamp: undefined }],
    ['a timestamp beyond the safe integer range', { ...createProject(), clientTimestamp: 2 ** 60 }],
    ['a create with null data', { ...createProject(), data: null }],
    ['an update with null data', { ...createProject(), action: 'update', data: null }],
    [
      'an update carrying only the patch check property',
      { ...createProject(), action: 'update', data: { isPatch: 'x' } },
    ],
  ])('rejects the whole push when one change has %s', async (_, invalid) => {
    const res = await push([createProject(), invalid]);

    expect(res.statusCode).toBe(400);
    expect(await countChanges()).toBe(0);
  });

  it.each([
    ['empty', []],
    ['over the limit', Array.from({ length: MAX_BATCH + 1 }, createProject)],
  ])('rejects a batch that is %s', async (_, changes) => {
    const res = await push(changes);

    expect(res.statusCode).toBe(400);
    expect(await countChanges()).toBe(0);
  });
});
