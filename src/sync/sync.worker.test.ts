import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { TransactionHost, TransactionNotActiveError } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { DataSource } from 'typeorm';
import { createTestApp, truncateAll } from '../../test/create-test-app.js';
import { IssuesService } from '../issues/issues.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { Change } from './change.entity.js';
import { ChangesService } from './changes.service.js';
import type { ChangeInput, Fields, Model, SyncTarget } from './sync.types.js';
import { SyncWorker } from './sync.worker.js';

const T = Date.parse('2026-01-15T10:00:00.000Z');
const SECOND = 1000;

const createProject = (recordId: string = randomUUID(), clientTimestamp = T): ChangeInput => ({
  model: 'projects',
  recordId,
  action: 'create',
  data: { name: 'Sync engine', status: 'active' },
  clientTimestamp,
});

const createIssue = (projectId: string, recordId: string = randomUUID()): ChangeInput => ({
  model: 'issues',
  recordId,
  action: 'create',
  data: {
    title: 'Retry pushes after reconnect',
    description: 'Pending changes stay queued while offline.',
    assigneeEmail: 'ada@example.com',
    priority: 'normal',
    status: 'backlog',
    projectId,
  },
  clientTimestamp: T - 10 * SECOND,
});

const update = (
  model: Model,
  recordId: string,
  data: Fields,
  clientTimestamp: number,
): ChangeInput => ({ model, recordId, action: 'update', data, clientTimestamp });

const remove = (model: Model, recordId: string, clientTimestamp: number): ChangeInput => ({
  model,
  recordId,
  action: 'delete',
  clientTimestamp,
});

let app: NestFastifyApplication;
let changes: ChangesService;
let worker: SyncWorker;
let projects: ProjectsService;
let issues: IssuesService;

beforeAll(async () => {
  app = await createTestApp();
  changes = app.get(ChangesService);
  worker = app.get(SyncWorker);
  projects = app.get(ProjectsService);
  issues = app.get(IssuesService);
});

beforeEach(() => truncateAll(app));

afterAll(() => app.close());

async function push(...batch: ChangeInput[]): Promise<void> {
  await changes.insertBatch(batch);
  await worker.drain();
}

async function changeRows() {
  const rows = await app
    .get(DataSource)
    .getRepository(Change)
    .find({ order: { id: 'ASC' } });
  return rows.map(({ action, status, applied, reason, syncId }) => ({
    action,
    status,
    applied,
    reason,
    syncId,
  }));
}

async function withIssue(): Promise<string> {
  const project = createProject();
  const issue = createIssue(project.recordId);
  await push(project, issue);
  return issue.recordId;
}

describe('SyncWorker', () => {
  it('creates a record with the client id and assigns sync id 1', async () => {
    const change = createProject();

    await push(change);

    expect(await projects.findById(change.recordId)).toMatchObject({
      id: change.recordId,
      ...change.data,
    });
    expect(await changeRows()).toEqual([
      { action: 'create', status: 'applied', applied: change.data, reason: null, syncId: 1 },
    ]);
  });

  it.each([
    ['in event order', false],
    ['in reverse order', true],
  ])('resolves the same field by client timestamp when changes arrive %s', async (_, reversed) => {
    const issueId = await withIssue();
    const done = update('issues', issueId, { status: 'done' }, T);
    const cancelled = update('issues', issueId, { status: 'cancelled' }, T + 2 * SECOND);

    for (const change of reversed ? [cancelled, done] : [done, cancelled]) {
      await push(change);
    }

    expect(await issues.findById(issueId)).toMatchObject({ status: 'cancelled' });
  });

  it('applies updates to different fields from both users', async () => {
    const issueId = await withIssue();

    await push(update('issues', issueId, { status: 'cancelled' }, T + 2 * SECOND));
    await push(update('issues', issueId, { assigneeEmail: 'ada@new.io' }, T));

    expect(await issues.findById(issueId)).toMatchObject({
      status: 'cancelled',
      assigneeEmail: 'ada@new.io',
    });
  });

  it('applies only the newer fields of a partly older update', async () => {
    const issueId = await withIssue();

    await push(update('issues', issueId, { status: 'cancelled' }, T + 2 * SECOND));
    await push(update('issues', issueId, { assigneeEmail: 'ada@new.io', status: 'done' }, T));

    expect(await issues.findById(issueId)).toMatchObject({
      status: 'cancelled',
      assigneeEmail: 'ada@new.io',
    });
    expect((await changeRows()).at(-1)).toMatchObject({
      status: 'applied',
      applied: { assigneeEmail: 'ada@new.io' },
    });
  });

  it('supersedes replayed create, update and delete', async () => {
    const create = createProject();
    const rename = update('projects', create.recordId, { name: 'Renamed' }, T + SECOND);
    const drop = remove('projects', create.recordId, T + 2 * SECOND);

    for (const change of [create, create, rename, rename, drop, drop]) {
      await push(change);
    }

    expect(
      (await changeRows()).map(({ status, reason, syncId }) => [status, reason, syncId]),
    ).toEqual([
      ['applied', null, 1],
      ['superseded', 'already exists', null],
      ['applied', null, 2],
      ['superseded', 'older than applied changes', null],
      ['applied', null, 3],
      ['superseded', 'deleted', null],
    ]);
  });

  it('lets a delete win over a later update and a later create', async () => {
    const create = createProject();
    await push(create, remove('projects', create.recordId, T + SECOND));

    await push(update('projects', create.recordId, { name: 'Late' }, T + 5 * SECOND));
    await push(createProject(create.recordId, T + 6 * SECOND));

    expect(await projects.findById(create.recordId)).toBeUndefined();
    expect((await changeRows()).slice(2)).toMatchObject([
      { status: 'superseded', reason: 'deleted' },
      { status: 'superseded', reason: 'deleted' },
    ]);
  });

  it('rejects an issue for a missing project and deleting a project with issues', async () => {
    const project = createProject();
    await push(project, createIssue(project.recordId));

    await push(createIssue(randomUUID()));
    await push(remove('projects', project.recordId, T + SECOND));

    expect(await projects.findById(project.recordId)).toBeDefined();
    expect((await changeRows()).slice(2)).toMatchObject([
      { status: 'rejected', reason: expect.stringContaining('does not exist'), syncId: null },
      { status: 'rejected', reason: expect.stringContaining('still has issues'), syncId: null },
    ]);
  });

  it('rejects an update and a delete of a missing record', async () => {
    const id = randomUUID();

    await push(update('members', id, { name: 'Ghost' }, T), remove('members', id, T));

    expect(await changeRows()).toMatchObject([
      { status: 'rejected', reason: 'not found' },
      { status: 'rejected', reason: 'not found' },
    ]);
  });

  it('runs one drain at a time and applies every change once', async () => {
    const loggedError = vi.spyOn(Logger.prototype, 'error');
    const [first, second] = [createProject(), createProject()];

    await changes.insertBatch([first]);
    const firstDrain = worker.drain();
    await changes.insertBatch([second]);
    const secondDrain = worker.drain();
    await Promise.all([firstDrain, secondDrain]);

    expect((await changeRows()).map(({ status, syncId }) => [status, syncId])).toEqual([
      ['applied', 1],
      ['applied', 2],
    ]);
    expect(loggedError).not.toHaveBeenCalled();
    loggedError.mockRestore();
  });

  it('leaves changes pending and stops on an unexpected error', async () => {
    const broken: SyncTarget = {
      findById: async () => undefined,
      create: async () => {
        throw new Error('boom');
      },
      update: async () => {
        throw new Error('unused');
      },
      delete: async () => {
        throw new Error('unused');
      },
    };
    const brokenWorker = new SyncWorker(
      changes,
      app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost),
      { projects, issues, members: broken },
    );
    const project = createProject();
    await changes.insertBatch([
      {
        model: 'members',
        recordId: randomUUID(),
        action: 'create',
        data: { name: 'Bot', status: 'invited' },
        clientTimestamp: T,
      },
      project,
    ]);

    await brokenWorker.drain();

    expect((await changeRows()).map(({ status }) => status)).toEqual(['pending', 'pending']);
    expect(await projects.findById(project.recordId)).toBeUndefined();
  });

  it('refuses to mark a change applied outside a transaction', async () => {
    const markOutsideTransaction = async () => changes.markApplied({ id: 1, applied: null });

    await expect(markOutsideTransaction()).rejects.toThrow(TransactionNotActiveError);
  });
});
