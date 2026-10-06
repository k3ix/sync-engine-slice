import type { FastifyPluginAsync } from 'fastify';
import { type IdParams, idParams, type Page, pageQuery, rowProperties } from '../schemas';
import {
  type CreateMember,
  MEMBER_STATUSES,
  type MembersService,
  type UpdateMember,
} from './members.service';

export const fields = {
  name: { type: 'string', minLength: 1 },
  status: { type: 'string', enum: MEMBER_STATUSES },
};

const member = { type: 'object', properties: { ...rowProperties, ...fields } };

const createBody = {
  type: 'object',
  properties: { ...fields, status: { ...fields.status, default: 'invited' } },
  required: ['name'],
  additionalProperties: false,
};

const updateBody = {
  type: 'object',
  properties: fields,
  minProperties: 1,
  additionalProperties: false,
};

export const membersRoutes: FastifyPluginAsync<{ service: MembersService }> = async (
  app,
  { service },
) => {
  app.post<{ Body: CreateMember }>(
    '/',
    { schema: { body: createBody, response: { 201: member } } },
    async (req, reply) => {
      reply.code(201);
      return service.create(req.body);
    },
  );

  app.get<{ Querystring: Page }>(
    '/',
    { schema: { querystring: pageQuery, response: { 200: { type: 'array', items: member } } } },
    async (req) => service.list(req.query),
  );

  app.get<{ Params: IdParams }>(
    '/:id',
    { schema: { params: idParams, response: { 200: member } } },
    async (req) => service.getById(req.params.id),
  );

  app.patch<{ Params: IdParams; Body: UpdateMember }>(
    '/:id',
    { schema: { params: idParams, body: updateBody, response: { 200: member } } },
    async (req) => service.update(req.params.id, req.body),
  );

  app.delete<{ Params: IdParams }>('/:id', { schema: { params: idParams } }, async (req, reply) => {
    service.delete(req.params.id);
    return reply.code(204).send();
  });
};
