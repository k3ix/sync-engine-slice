import { DatabaseSync } from 'node:sqlite';

export const DB_PATH = process.env.DB_PATH ?? 'data.db';
export const WORKSPACE_ID = 'default';

const SQLITE_CONSTRAINT_FOREIGNKEY = 787;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  workspace_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  assignee_email TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('normal', 'urgent')),
  status TEXT NOT NULL CHECK (status IN ('backlog', 'in_progress', 'done', 'cancelled')),
  project_id TEXT NOT NULL REFERENCES projects (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  workspace_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS issues_project_id_idx ON issues (project_id);

CREATE TABLE IF NOT EXISTS changes (
  id INTEGER PRIMARY KEY,
  model TEXT NOT NULL CHECK (model IN ('projects', 'issues', 'members')),
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  data TEXT,
  client_ts INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'superseded', 'rejected')),
  applied TEXT,
  reason TEXT,
  sync_id INTEGER UNIQUE,
  received_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS changes_pending_idx ON changes (id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS changes_record_idx ON changes (model, record_id);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('invited', 'active', 'suspended', 'deactivated')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  workspace_id TEXT NOT NULL
);
`;

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export function isForeignKeyError(err: unknown): boolean {
  return err instanceof Error && 'errcode' in err && err.errcode === SQLITE_CONSTRAINT_FOREIGNKEY;
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
