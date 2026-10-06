const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type IdParams = { id: string };
export type Page = { limit: number; offset: number };

export const idParams = {
  type: 'object',
  properties: { id: { type: 'string' } },
  required: ['id'],
};

export const pageProperties = {
  limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT },
  offset: { type: 'integer', minimum: 0, default: 0 },
};

export const pageQuery = {
  type: 'object',
  properties: pageProperties,
  additionalProperties: false,
};

export const rowProperties = {
  id: { type: 'string' },
  created_at: { type: 'string' },
  updated_at: { type: 'string' },
  workspace_id: { type: 'string' },
};
