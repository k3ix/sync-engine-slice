export const MODELS = ['projects', 'issues', 'members'] as const;
export const ACTIONS = ['create', 'update', 'delete'] as const;
export type Model = (typeof MODELS)[number];
export type Action = (typeof ACTIONS)[number];
export type Fields = Record<string, string>;

export type ChangeInput = {
  model: Model;
  recordId: string;
  action: Action;
  data?: Fields;
  clientTimestamp: number;
};

export type SyncTarget = {
  findById(id: string): Promise<object | undefined>;
  create(input: Fields): Promise<object>;
  update(id: string, patch: Fields): Promise<object>;
  delete(id: string): Promise<void>;
};

export const SYNC_TARGETS = Symbol('SYNC_TARGETS');

export function isModel(value: unknown): value is Model {
  return MODELS.some((model) => model === value);
}
