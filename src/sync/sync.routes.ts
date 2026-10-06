import type { FastifyPluginAsync } from 'fastify';
import { fields as issueFields } from '../issues/issues.routes';
import { fields as memberFields } from '../members/members.routes';
import { fields as projectFields } from '../projects/projects.routes';
import type { ChangeInput, ChangesService, Model } from './changes.service';

const MAX_BATCH = 100;

const fieldsByModel: Record<Model, Record<string, object>> = {
  projects: projectFields,
  issues: issueFields,
  members: memberFields,
};

function changeSchema(model: string, action: string, data?: object) {
  return {
    type: 'object',
    properties: {
      model: { const: model },
      action: { const: action },
      recordId: { type: 'string', format: 'uuid' },
      clientTimestamp: { type: 'integer', minimum: 0 },
      ...(data && { data }),
    },
    required: ['model', 'action', 'recordId', 'clientTimestamp', ...(data ? ['data'] : [])],
    additionalProperties: false,
  };
}

const changeSchemas = Object.entries(fieldsByModel).flatMap(([model, fields]) => [
  changeSchema(model, 'create', {
    type: 'object',
    properties: fields,
    required: Object.keys(fields),
    additionalProperties: false,
  }),
  changeSchema(model, 'update', {
    type: 'object',
    properties: fields,
    minProperties: 1,
    additionalProperties: false,
  }),
  changeSchema(model, 'delete'),
]);

const pushBody = {
  type: 'object',
  properties: {
    changes: { type: 'array', minItems: 1, maxItems: MAX_BATCH, items: { oneOf: changeSchemas } },
  },
  required: ['changes'],
  additionalProperties: false,
};

type SyncRoutesOptions = { changes: ChangesService; onPushed: () => void };

export const syncRoutes: FastifyPluginAsync<SyncRoutesOptions> = async (
  app,
  { changes, onPushed },
) => {
  app.post<{ Body: { changes: ChangeInput[] } }>(
    '/changes',
    { schema: { body: pushBody } },
    async (req, reply) => {
      changes.insertBatch(req.body.changes);
      onPushed();
      return reply.code(202).send();
    },
  );
};
