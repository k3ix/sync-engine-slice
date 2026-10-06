import type { DatabaseSync } from 'node:sqlite';
import { transaction } from '../db';

export type Model = 'projects' | 'issues' | 'members';
export type Action = 'create' | 'update' | 'delete';
export type Fields = Record<string, string>;

export type ChangeInput = {
  model: Model;
  recordId: string;
  action: Action;
  data?: Fields;
  clientTimestamp: number;
};

export type PendingChange = {
  id: number;
  model: Model;
  recordId: string;
  action: Action;
  data: Fields;
  clientTs: number;
};

export type AppliedChange = { action: Action; clientTs: number; applied: Fields | null };

type PendingRow = {
  id: number;
  model: Model;
  record_id: string;
  action: Action;
  data: string | null;
  client_ts: number;
};

type AppliedRow = { action: Action; client_ts: number; applied: string | null };

function parseFields(json: string | null): Fields | null {
  return json === null ? null : (JSON.parse(json) as Fields);
}

export class ChangesService {
  constructor(private readonly db: DatabaseSync) {}

  insertBatch(changes: ChangeInput[]): void {
    const insert = this.db.prepare(
      `INSERT INTO changes (model, record_id, action, data, client_ts, status, received_at)
       VALUES (:model, :record_id, :action, :data, :client_ts, 'pending', :now)`,
    );
    const now = new Date().toISOString();
    transaction(this.db, () => {
      for (const change of changes) {
        insert.run({
          model: change.model,
          record_id: change.recordId,
          action: change.action,
          data: change.data ? JSON.stringify(change.data) : null,
          client_ts: change.clientTimestamp,
          now,
        });
      }
    });
  }

  findNextPending(): PendingChange | undefined {
    const row = this.db
      .prepare(
        `SELECT id, model, record_id, action, data, client_ts FROM changes
         WHERE status = 'pending'
         ORDER BY id
         LIMIT 1`,
      )
      .get() as PendingRow | undefined;
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      model: row.model,
      recordId: row.record_id,
      action: row.action,
      data: parseFields(row.data) ?? {},
      clientTs: row.client_ts,
    };
  }

  listApplied(model: Model, recordId: string): AppliedChange[] {
    const rows = this.db
      .prepare(
        `SELECT action, client_ts, applied FROM changes
         WHERE model = ? AND record_id = ? AND status = 'applied'
         ORDER BY sync_id`,
      )
      .all(model, recordId) as AppliedRow[];
    return rows.map((row) => ({
      action: row.action,
      clientTs: row.client_ts,
      applied: parseFields(row.applied),
    }));
  }

  // Must run inside the transaction that wrote the data, so the sync id and the write commit together.
  markApplied(id: number, applied: Fields | null): void {
    this.db
      .prepare(
        `UPDATE changes
         SET status = 'applied', applied = :applied, processed_at = :now,
             sync_id = (SELECT COALESCE(MAX(sync_id), 0) + 1 FROM changes)
         WHERE id = :id`,
      )
      .run({ id, applied: applied && JSON.stringify(applied), now: new Date().toISOString() });
  }

  markSkipped(id: number, status: 'superseded' | 'rejected', reason: string): void {
    this.db
      .prepare(
        `UPDATE changes SET status = :status, reason = :reason, processed_at = :now WHERE id = :id`,
      )
      .run({ id, status, reason, now: new Date().toISOString() });
  }
}
