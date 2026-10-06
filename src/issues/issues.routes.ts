import type { FastifyPluginAsync } from 'fastify';
import { type IdParams, idParams, pageProperties, rowProperties } from '../schemas';
import {
  type CreateIssue,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type IssuesService,
  type ListIssues,
  type UpdateIssue,
} from './issues.service';

const name = { type: 'string', minLength: 1 };
const projectId = { type: 'string', minLength: 1 };

export const fields = {
  title: name,
  description: name,
  assignee_email: { type: 'string', format: 'email' },
  priority: { type: 'string', enum: ISSUE_PRIORITIES },
  status: { type: 'string', enum: ISSUE_STATUSES },
  project_id: projectId,
};

const issue = { type: 'object', properties: { ...rowProperties, ...fields } };

const createBody = {
  type: 'object',
  properties: { ...fields, priority: { ...fields.priority, default: 'normal' } },
  required: ['title', 'description', 'assignee_email', 'status', 'project_id'],
  additionalProperties: false,
};

const updateBody = {
  type: 'object',
  properties: fields,
  minProperties: 1,
  additionalProperties: false,
};

const listQuery = {
  type: 'object',
  properties: { ...pageProperties, project_id: projectId },
  additionalProperties: false,
};

export const issuesRoutes: FastifyPluginAsync<{ service: IssuesService }> = async (
  app,
  { service },
) => {
  app.post<{ Body: CreateIssue }>(
    '/',
    { schema: { body: createBody, response: { 201: issue } } },
    async (req, reply) => {
      reply.code(201);
      return service.create(req.body);
    },
  );

  app.get<{ Querystring: ListIssues }>(
    '/',
    { schema: { querystring: listQuery, response: { 200: { type: 'array', items: issue } } } },
    async (req) => service.list(req.query),
  );

  app.get<{ Params: IdParams }>(
    '/:id',
    { schema: { params: idParams, response: { 200: issue } } },
    async (req) => service.getById(req.params.id),
  );

  app.patch<{ Params: IdParams; Body: UpdateIssue }>(
    '/:id',
    { schema: { params: idParams, body: updateBody, response: { 200: issue } } },
    async (req) => service.update(req.params.id, req.body),
  );

  app.delete<{ Params: IdParams }>('/:id', { schema: { params: idParams } }, async (req, reply) => {
    service.delete(req.params.id);
    return reply.code(204).send();
  });
};
