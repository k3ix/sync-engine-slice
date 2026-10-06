import type { FastifyPluginAsync } from 'fastify';
import { type IdParams, idParams, type Page, pageQuery, rowProperties } from '../schemas';
import {
  type CreateProject,
  PROJECT_STATUSES,
  type ProjectsService,
  type UpdateProject,
} from './projects.service';

export const fields = {
  name: { type: 'string', minLength: 1 },
  status: { type: 'string', enum: PROJECT_STATUSES },
};

const project = { type: 'object', properties: { ...rowProperties, ...fields } };

const createBody = {
  type: 'object',
  properties: { ...fields, status: { ...fields.status, default: 'draft' } },
  required: ['name'],
  additionalProperties: false,
};

const updateBody = {
  type: 'object',
  properties: fields,
  minProperties: 1,
  additionalProperties: false,
};

export const projectsRoutes: FastifyPluginAsync<{ service: ProjectsService }> = async (
  app,
  { service },
) => {
  app.post<{ Body: CreateProject }>(
    '/',
    { schema: { body: createBody, response: { 201: project } } },
    async (req, reply) => {
      reply.code(201);
      return service.create(req.body);
    },
  );

  app.get<{ Querystring: Page }>(
    '/',
    { schema: { querystring: pageQuery, response: { 200: { type: 'array', items: project } } } },
    async (req) => service.list(req.query),
  );

  app.get<{ Params: IdParams }>(
    '/:id',
    { schema: { params: idParams, response: { 200: project } } },
    async (req) => service.getById(req.params.id),
  );

  app.patch<{ Params: IdParams; Body: UpdateProject }>(
    '/:id',
    { schema: { params: idParams, body: updateBody, response: { 200: project } } },
    async (req) => service.update(req.params.id, req.body),
  );

  app.delete<{ Params: IdParams }>('/:id', { schema: { params: idParams } }, async (req, reply) => {
    service.delete(req.params.id);
    return reply.code(204).send();
  });
};
