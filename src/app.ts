import type { DatabaseSync } from 'node:sqlite';
import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
import { issuesRoutes } from './issues/issues.routes';
import { IssuesService } from './issues/issues.service';
import { membersRoutes } from './members/members.routes';
import { MembersService } from './members/members.service';
import { projectsRoutes } from './projects/projects.routes';
import { ProjectsService } from './projects/projects.service';
import { ChangesService } from './sync/changes.service';
import { syncRoutes } from './sync/sync.routes';
import { SyncWorker } from './sync/sync.worker';

const INTERNAL_ERROR = 500;

type AppOptions = FastifyServerOptions & { db: DatabaseSync };

export function buildApp({ db, ...opts }: AppOptions) {
  // Fastify strips unknown body fields by default; we want them rejected with 400 instead.
  const app = Fastify({ ...opts, ajv: { customOptions: { removeAdditional: false } } });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    const statusCode = err.statusCode ?? INTERNAL_ERROR;
    if (statusCode >= INTERNAL_ERROR) {
      req.log.error(err);
      return reply.code(INTERNAL_ERROR).send({ error: 'Internal Server Error' });
    }
    return reply.code(statusCode).send({ error: err.message });
  });

  app.addHook('onClose', async () => db.close());

  app.get('/health', async () => ({ status: 'ok' }));

  const projects = new ProjectsService(db);
  const issues = new IssuesService(db);
  const members = new MembersService(db);
  const changes = new ChangesService(db);
  const worker = new SyncWorker(db, changes, { projects, issues, members });

  const drain = () => {
    try {
      worker.drain();
    } catch (err) {
      app.log.error(err, 'sync drain stopped; the failed change stays pending');
    }
  };
  // Picks up changes left pending by a crash or a stopped drain.
  app.addHook('onReady', async () => drain());

  app.register(projectsRoutes, { prefix: '/projects', service: projects });
  app.register(issuesRoutes, { prefix: '/issues', service: issues });
  app.register(membersRoutes, { prefix: '/members', service: members });
  app.register(syncRoutes, { prefix: '/sync', changes, onPushed: () => setImmediate(drain) });

  return app;
}
