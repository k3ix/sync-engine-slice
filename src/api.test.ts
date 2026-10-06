import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { openDb, WORKSPACE_ID } from './db';

type Body = Record<string, unknown>;

async function create(app: FastifyInstance, url: string, payload: Body): Promise<Body> {
  const res = await app.inject({ method: 'POST', url, payload });
  expect(res.statusCode).toBe(201);
  return res.json();
}

const createProject = (app: FastifyInstance) => create(app, '/projects', { name: 'Sync engine' });

const resources = [
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
    payload: async (app: FastifyInstance) => ({
      title: 'Retry pushes after reconnect',
      description: 'Pending changes stay queued while offline.',
      assignee_email: 'ada@example.com',
      status: 'backlog',
      project_id: (await createProject(app)).id,
    }),
    defaults: { priority: 'normal' },
    patch: { status: 'done' },
  },
];

let app: FastifyInstance;

beforeEach(() => {
  app = buildApp({ db: openDb(':memory:') });
});

afterEach(() => app.close());

describe.each(resources)('$url', ({ url, payload, defaults, patch }) => {
  it('creates with server-set fields and defaults', async () => {
    const input = await payload(app);
    const created = await create(app, url, input);

    expect(created).toEqual({
      ...input,
      ...defaults,
      id: expect.any(String),
      workspace_id: WORKSPACE_ID,
      created_at: expect.any(String),
      updated_at: created.created_at,
    });
  });

  it('gets by id and returns 404 for an unknown id', async () => {
    const created = await create(app, url, await payload(app));

    const found = await app.inject({ method: 'GET', url: `${url}/${created.id}` });
    const missing = await app.inject({ method: 'GET', url: `${url}/nope` });

    expect(found.json()).toEqual(created);
    expect(missing.statusCode).toBe(404);
  });

  it('lists with limit and offset', async () => {
    const first = await create(app, url, await payload(app));
    const second = await create(app, url, await payload(app));

    const page1 = await app.inject({ method: 'GET', url: `${url}?limit=1` });
    const page2 = await app.inject({ method: 'GET', url: `${url}?limit=1&offset=1` });

    expect(page1.json()).toEqual([first]);
    expect(page2.json()).toEqual([second]);
  });

  it('updates fields and bumps updated_at', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const created = await create(app, url, await payload(app));
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));

    const res = await app.inject({ method: 'PATCH', url: `${url}/${created.id}`, payload: patch });
    vi.useRealTimers();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ...created, ...patch, updated_at: '2026-01-02T00:00:00.000Z' });
  });

  it.each([
    ['an empty body', {}],
    ['an unknown field', { nope: 1 }],
    ['a server-set field', { id: 'x' }],
    ['an invalid status', { status: 'nope' }],
  ])('rejects a patch with %s', async (_, body) => {
    const created = await create(app, url, await payload(app));

    const res = await app.inject({ method: 'PATCH', url: `${url}/${created.id}`, payload: body });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when patching an unknown id', async () => {
    const res = await app.inject({ method: 'PATCH', url: `${url}/nope`, payload: patch });

    expect(res.statusCode).toBe(404);
  });

  it('deletes idempotently', async () => {
    const created = await create(app, url, await payload(app));

    const first = await app.inject({ method: 'DELETE', url: `${url}/${created.id}` });
    const second = await app.inject({ method: 'DELETE', url: `${url}/${created.id}` });
    const found = await app.inject({ method: 'GET', url: `${url}/${created.id}` });

    expect(first.statusCode).toBe(204);
    expect(second.statusCode).toBe(204);
    expect(found.statusCode).toBe(404);
  });
});

describe('issues and projects', () => {
  const issue = (project_id: unknown) => ({
    title: 'Retry pushes after reconnect',
    description: 'Pending changes stay queued while offline.',
    assignee_email: 'ada@example.com',
    status: 'backlog',
    project_id,
  });

  it('rejects an issue for an unknown project', async () => {
    const res = await app.inject({ method: 'POST', url: '/issues', payload: issue('nope') });

    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid assignee_email', async () => {
    const project = await createProject(app);

    const res = await app.inject({
      method: 'POST',
      url: '/issues',
      payload: { ...issue(project.id), assignee_email: 'not-an-email' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('refuses to delete a project that still has issues', async () => {
    const project = await createProject(app);
    await create(app, '/issues', issue(project.id));

    const res = await app.inject({ method: 'DELETE', url: `/projects/${project.id}` });

    expect(res.statusCode).toBe(409);
  });

  it('filters issues by project', async () => {
    const [a, b] = [await createProject(app), await createProject(app)];
    const issueA = await create(app, '/issues', issue(a.id));
    await create(app, '/issues', issue(b.id));

    const res = await app.inject({ method: 'GET', url: `/issues?project_id=${a.id}` });

    expect(res.json()).toEqual([issueA]);
  });
});
