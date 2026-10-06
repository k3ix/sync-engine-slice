import type { DatabaseSync } from 'node:sqlite';
import { transaction } from '../db';
import { HttpError } from '../http-error';
import type {
  AppliedChange,
  ChangesService,
  Fields,
  Model,
  PendingChange,
} from './changes.service';

export type SyncTarget = {
  findById(id: string): object | undefined;
  create(input: Fields, id: string): object;
  update(id: string, patch: Fields): object;
  delete(id: string): void;
};

// A field wins only if every applied write to it is strictly older, so a replay (same timestamp) loses.
export function winningFields(data: Fields, clientTs: number, history: AppliedChange[]): Fields {
  return Object.fromEntries(
    Object.entries(data).filter(([field]) =>
      history.every(
        (entry) => !entry.applied || !(field in entry.applied) || entry.clientTs < clientTs,
      ),
    ),
  );
}

export class SyncWorker {
  constructor(
    private readonly db: DatabaseSync,
    private readonly changes: ChangesService,
    private readonly services: Record<Model, SyncTarget>,
  ) {}

  drain(): void {
    let change = this.changes.findNextPending();
    while (change) {
      const current = change;
      transaction(this.db, () => this.process(current));
      change = this.changes.findNextPending();
    }
  }

  private process(change: PendingChange): void {
    const history = this.changes.listApplied(change.model, change.recordId);
    if (history.some(({ action }) => action === 'delete')) {
      this.changes.markSkipped(change.id, 'superseded', 'deleted');
      return;
    }
    try {
      this.apply(change, history);
    } catch (err) {
      if (!(err instanceof HttpError)) {
        throw err;
      }
      this.changes.markSkipped(change.id, 'rejected', err.message);
    }
  }

  private apply(
    { id, model, recordId, action, data, clientTs }: PendingChange,
    history: AppliedChange[],
  ): void {
    const service = this.services[model];
    const exists = service.findById(recordId) !== undefined;

    if (action === 'create') {
      if (exists) {
        this.changes.markSkipped(id, 'superseded', 'already exists');
        return;
      }
      service.create(data, recordId);
      this.changes.markApplied(id, data);
      return;
    }

    if (!exists) {
      this.changes.markSkipped(id, 'rejected', 'not found');
      return;
    }

    if (action === 'delete') {
      service.delete(recordId);
      this.changes.markApplied(id, null);
      return;
    }

    const fields = winningFields(data, clientTs, history);
    if (Object.keys(fields).length === 0) {
      this.changes.markSkipped(id, 'superseded', 'older than applied changes');
      return;
    }
    service.update(recordId, fields);
    this.changes.markApplied(id, fields);
  }
}
