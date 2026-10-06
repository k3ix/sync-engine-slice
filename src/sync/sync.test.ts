import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { setImmediate as nextTick } from 'node:timers/promises';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { openDb } from '../db';
import { IssuesService } from '../issues/issues.service';
import { MembersService } from '../members/members.service';
import { ProjectsService } from '../projects/projects.service';
import { type ChangeInput, ChangesService, type Fields, type Model } from './changes.service';
import { type SyncTarget, SyncWorker } from './sync.worker';

type ChangeRow = {
  action: string;
  status: string;
  applied: string | null;
  reason: string | null;
  sync_id: number | null;
};

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
    assignee_email: 'ada@example.com',
    priority: 'normal',
    status: 'backlog',
    project_id: projectId,
  },
  clientTimestamp: T - 10 * SECOND,
});

const update = (
  model: Model,
  recordId: string,
  data: Fields,
  clientTimestamp: number,
): ChangeInput => ({
  model,
  recordId,
  action: 'update',
  data,
  clientTimestamp,
});

const remove = (model: Model, recordId: string, clientTimestamp: number): ChangeInput => ({
  model,
  recordId,
  action: 'delete',
  clientTimestamp,
});

describe('SyncWorker', () => {
  let db: DatabaseSync;
  let services: Record<Model, SyncTarget>;
  let changes: ChangesService;
  let worker: SyncWorker;

  beforeEach(() => {
    db = openDb(':memory:');
    services = {
      projects: new ProjectsService(db),
      issues: new IssuesService(db),
      members: new MembersService(db),
    };
    changes = new ChangesService(db);
    worker = new SyncWorker(db, changes, services);
  });

  afterEach(() => db.close());

  function push(...batch: ChangeInput[]) {
    changes.insertBatch(batch);
    worker.drain();
  }

  function changeRows() {
    const rows = db
      .prepare('SELECT action, status, applied, reason, sync_id FROM changes ORDER BY id')
      .all() as ChangeRow[];
    return rows.map((row) => ({
      ...row,
      applied: row.applied === null ? null : (JSON.parse(row.applied) as Fields),
    }));
  }

  function withIssue() {
    const project = createProject();
    const issue = createIssue(project.recordId);
    push(project, issue);
    return issue.recordId;
  }

  it('creates a record with the client id and assigns sync id 1', () => {
    const change = createProject();

    push(change);

    expect(services.projects.findById(change.recordId)).toMatchObject({
      id: change.recordId,
      ...change.data,
    });
    expect(changeRows()).toEqual([
      { action: 'create', status: 'applied', applied: change.data, reason: null, sync_id: 1 },
    ]);
  });

  it.each([
    ['in event order', false],
    ['in reverse order', true],
  ])('resolves the same field by client timestamp when changes arrive %s', (_, reversed) => {
    const issueId = withIssue();
    const done = update('issues', issueId, { status: 'done' }, T);
    const cancelled = update('issues', issueId, { status: 'cancelled' }, T + 2 * SECOND);

    for (const change of reversed ? [cancelled, done] : [done, cancelled]) {
      push(change);
    }

    expect(services.issues.findById(issueId)).toMatchObject({ status: 'cancelled' });
  });

  it('applies updates to different fields from both users', () => {
    const issueId = withIssue();

    push(update('issues', issueId, { status: 'cancelled' }, T + 2 * SECOND));
    push(update('issues', issueId, { assignee_email: 'ada@new.io' }, T));

    expect(services.issues.findById(issueId)).toMatchObject({
      status: 'cancelled',
      assignee_email: 'ada@new.io',
    });
  });

  it('applies only the newer fields of a partly older update', () => {
    const issueId = withIssue();

    push(update('issues', issueId, { status: 'cancelled' }, T + 2 * SECOND));
    push(update('issues', issueId, { assignee_email: 'ada@new.io', status: 'done' }, T));

    expect(services.issues.findById(issueId)).toMatchObject({
      status: 'cancelled',
      assignee_email: 'ada@new.io',
    });
    expect(changeRows().at(-1)).toMatchObject({
      status: 'applied',
      applied: { assignee_email: 'ada@new.io' },
    });
  });

  it('supersedes replayed create, update and delete', () => {
    const create = createProject();
    const rename = update('projects', create.recordId, { name: 'Renamed' }, T + SECOND);
    const drop = remove('projects', create.recordId, T + 2 * SECOND);

    for (const change of [create, create, rename, rename, drop, drop]) {
      push(change);
    }

    expect(changeRows().map(({ status, reason, sync_id }) => [status, reason, sync_id])).toEqual([
      ['applied', null, 1],
      ['superseded', 'already exists', null],
      ['applied', null, 2],
      ['superseded', 'older than applied changes', null],
      ['applied', null, 3],
      ['superseded', 'deleted', null],
    ]);
  });

  it('lets a delete win over a later update and a later create', () => {
    const create = createProject();
    push(create, remove('projects', create.recordId, T + SECOND));

    push(update('projects', create.recordId, { name: 'Late' }, T + 5 * SECOND));
    push(createProject(create.recordId, T + 6 * SECOND));

    expect(services.projects.findById(create.recordId)).toBeUndefined();
    expect(changeRows().slice(2)).toMatchObject([
      { status: 'superseded', reason: 'deleted' },
      { status: 'superseded', reason: 'deleted' },
    ]);
  });

  it('rejects an issue for a missing project and deleting a project with issues', () => {
    const project = createProject();
    push(project, createIssue(project.recordId));

    push(createIssue(randomUUID()));
    push(remove('projects', project.recordId, T + SECOND));

    expect(services.projects.findById(project.recordId)).toBeDefined();
    expect(changeRows().slice(2)).toMatchObject([
      { status: 'rejected', reason: expect.stringContaining('does not exist'), sync_id: null },
      { status: 'rejected', reason: expect.stringContaining('still has issues'), sync_id: null },
    ]);
  });

  it('rejects an update and a delete of a missing record', () => {
    const id = randomUUID();

    push(update('members', id, { name: 'Ghost' }, T), remove('members', id, T));

    expect(changeRows()).toMatchObject([
      { status: 'rejected', reason: 'not found' },
      { status: 'rejected', reason: 'not found' },
    ]);
  });

  it('leaves changes pending and stops on an unexpected error', () => {
    const broken: SyncTarget = {
      ...services.members,
      findById: () => undefined,
      create: () => {
        throw new Error('boom');
      },
    };
    worker = new SyncWorker(db, changes, { ...services, members: broken });
    const project = createProject();
    changes.insertBatch([
      {
        model: 'members',
        recordId: randomUUID(),
        action: 'create',
        data: { name: 'Bot', status: 'invited' },
        clientTimestamp: T,
      },
      project,
    ]);

    expect(() => worker.drain()).toThrow('boom');
    expect(changeRows().map(({ status }) => status)).toEqual(['pending', 'pending']);
    expect(services.projects.findById(project.recordId)).toBeUndefined();
  });
});

describe('POST /sync/changes', () => {
  let db: DatabaseSync;
  let app: FastifyInstance;

  beforeEach(() => {
    db = openDb(':memory:');
    app = buildApp({ db });
  });

  afterEach(() => app.close());

  const countChanges = () => db.prepare('SELECT COUNT(*) AS n FROM changes').get()?.n;

  it('accepts changes with 202 and applies them in the background', async () => {
    const change = createProject();

    const res = await app.inject({
      method: 'POST',
      url: '/sync/changes',
      payload: { changes: [change] },
    });
    await nextTick();
    const found = await app.inject({ method: 'GET', url: `/projects/${change.recordId}` });

    expect(res.statusCode).toBe(202);
    expect(res.body).toBe('');
    expect(found.json()).toMatchObject({ id: change.recordId, name: 'Sync engine' });
  });

  it.each([
    ['an unknown model', { ...createProject(), model: 'users' }],
    ['a delete with data', { ...remove('projects', randomUUID(), T), data: { name: 'x' } }],
    ['a create missing a field', { ...createProject(), data: { name: 'Q4' } }],
    ['an update with no fields', update('projects', randomUUID(), {}, T)],
    ['an invalid enum value', update('members', randomUUID(), { status: 'sleeping' }, T)],
    ['a record id that is not a uuid', { ...createProject(), recordId: 'abc' }],
    ['a missing timestamp', { ...createProject(), clientTimestamp: undefined }],
  ])('rejects the whole push when one change has %s', async (_, invalid) => {
    const res = await app.inject({
      method: 'POST',
      url: '/sync/changes',
      payload: { changes: [createProject(), invalid] },
    });

    expect(res.statusCode).toBe(400);
    expect(countChanges()).toBe(0);
  });
});
