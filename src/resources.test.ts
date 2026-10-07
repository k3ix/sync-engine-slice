import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp, truncateAll } from '../test/create-test-app.js';
import { WORKSPACE_ID } from './common/workspace.constants.js';

type Body = Record<string, unknown>;
type Resource = {
  url: string;
  payload: () => Promise<Body>;
  defaults: Body;
  patch: Body;
};

const TIMESTAMP_STEP_MS = 5;

let app: NestFastifyApplication;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(() => truncateAll(app));

afterAll(() => app.close());

async function create(url: string, payload: Body): Promise<Body> {
  const res = await app.inject({ method: 'POST', url, payload });
  expect(res.statusCode).toBe(201);
  return res.json();
}

const createProject = () => create('/projects', { name: 'Sync engine' });

const issue = (projectId: unknown) => ({
  title: 'Retry pushes after reconnect',
  description: 'Pending changes stay queued while offline.',
  assigneeEmail: 'ada@example.com',
  status: 'backlog',
  projectId,
});

const resources: Resource[] = [
  {
    url: '/projects',
    payload: async () => ({ name: 'Sync engine' }),
    defaults: { status: 'draft' },
    patch: { status: 'active' },
  },
  {
    url: '/members',
    payload: async () => ({ name: 'Grace Hopper' }),
    defaults: { status: 'invited' },
    patch: { status: 'active' },
  },
  {
    url: '/issues',
    payload: async () => issue((await createProject()).id),
    defaults: { priority: 'normal' },
    patch: { status: 'done' },
  },
];

describe.each(resources)('$url', ({ url, payload, defaults, patch }) => {
  it('creates with server-set fields and defaults', async () => {
    const input = await payload();

    const created = await create(url, input);

    expect(created).toEqual({
      ...input,
      ...defaults,
      id: expect.any(String),
      workspaceId: WORKSPACE_ID,
      createdAt: expect.any(String),
      updatedAt: created.createdAt,
    });
  });

  it.each([
    ['an unknown field', { nope: 1 }],
    ['a server-set field', { id: randomUUID() }],
  ])('rejects a create with %s', async (_, extra) => {
    const res = await app.inject({
      method: 'POST',
      url,
      payload: { ...(await payload()), ...extra },
    });

    expect(res.statusCode).toBe(400);
  });

  it('gets by id', async () => {
    const created = await create(url, await payload());

    const found = await app.inject({ method: 'GET', url: `${url}/${created.id}` });

    expect(found.json()).toEqual(created);
  });

  it('returns 404 for an unknown id and 400 for a malformed one', async () => {
    const missing = await app.inject({ method: 'GET', url: `${url}/${randomUUID()}` });
    const malformed = await app.inject({ method: 'GET', url: `${url}/abc` });

    expect(missing.statusCode).toBe(404);
    expect(malformed.statusCode).toBe(400);
  });

  it('lists with limit and offset in creation order', async () => {
    const first = await create(url, await payload());
    const second = await create(url, await payload());

    const page1 = await app.inject({ method: 'GET', url: `${url}?limit=1` });
    const page2 = await app.inject({ method: 'GET', url: `${url}?limit=1&offset=1` });

    expect(page1.json()).toEqual([first]);
    expect(page2.json()).toEqual([second]);
  });

  it.each(['limit=0', 'limit=101', 'limit=abc', 'offset=-1', 'nope=1'])(
    'rejects a list with %s',
    async (query) => {
      const res = await app.inject({ method: 'GET', url: `${url}?${query}` });

      expect(res.statusCode).toBe(400);
    },
  );

  it('updates only the sent fields and moves updatedAt forward', async () => {
    const created = await create(url, await payload());
    await sleep(TIMESTAMP_STEP_MS);

    const res = await app.inject({ method: 'PATCH', url: `${url}/${created.id}`, payload: patch });

    expect(res.statusCode).toBe(200);
    const updated = res.json();
    expect(updated).toEqual({ ...created, ...patch, updatedAt: expect.any(String) });
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(String(created.updatedAt)));
  });

  it.each([
    ['an empty body', {}],
    ['an unknown field', { nope: 1 }],
    ['a server-set field', { id: randomUUID() }],
    ['an invalid status', { status: 'nope' }],
    ['a null field', { status: null }],
  ])('rejects a patch with %s', async (_, body) => {
    const created = await create(url, await payload());

    const res = await app.inject({ method: 'PATCH', url: `${url}/${created.id}`, payload: body });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when patching an unknown id', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `${url}/${randomUUID()}`,
      payload: patch,
    });

    expect(res.statusCode).toBe(404);
  });

  it('deletes idempotently', async () => {
    const created = await create(url, await payload());

    const first = await app.inject({ method: 'DELETE', url: `${url}/${created.id}` });
    const second = await app.inject({ method: 'DELETE', url: `${url}/${created.id}` });
    const found = await app.inject({ method: 'GET', url: `${url}/${created.id}` });

    expect(first.statusCode).toBe(204);
    expect(second.statusCode).toBe(204);
    expect(found.statusCode).toBe(404);
  });
});

describe('issues and projects', () => {
  it('rejects an issue for an unknown project', async () => {
    const res = await app.inject({ method: 'POST', url: '/issues', payload: issue(randomUUID()) });

    expect(res.statusCode).toBe(400);
  });

  it('rejects moving an issue to an unknown project', async () => {
    const created = await create('/issues', issue((await createProject()).id));

    const res = await app.inject({
      method: 'PATCH',
      url: `/issues/${created.id}`,
      payload: { projectId: randomUUID() },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid assigneeEmail', async () => {
    const project = await createProject();

    const res = await app.inject({
      method: 'POST',
      url: '/issues',
      payload: { ...issue(project.id), assigneeEmail: 'not-an-email' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('refuses to delete a project that still has issues', async () => {
    const project = await createProject();
    await create('/issues', issue(project.id));

    const res = await app.inject({ method: 'DELETE', url: `/projects/${project.id}` });

    expect(res.statusCode).toBe(409);
  });

  it('filters issues by project', async () => {
    const [a, b] = [await createProject(), await createProject()];
    const issueA = await create('/issues', issue(a.id));
    await create('/issues', issue(b.id));

    const res = await app.inject({ method: 'GET', url: `/issues?projectId=${a.id}` });

    expect(res.json()).toEqual([issueA]);
  });

  it('rejects a malformed projectId filter', async () => {
    const res = await app.inject({ method: 'GET', url: '/issues?projectId=abc' });

    expect(res.statusCode).toBe(400);
  });
});
