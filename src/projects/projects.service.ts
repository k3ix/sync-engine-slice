import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { isForeignKeyError, WORKSPACE_ID } from '../db';
import { HttpError } from '../http-error';
import type { Page } from '../schemas';

export const PROJECT_STATUSES = ['draft', 'active', 'paused', 'completed'] as const;

export type Project = {
  id: string;
  name: string;
  status: (typeof PROJECT_STATUSES)[number];
  created_at: string;
  updated_at: string;
  workspace_id: string;
};

export type CreateProject = Pick<Project, 'name' | 'status'>;
export type UpdateProject = Partial<CreateProject>;

export class ProjectsService {
  constructor(private readonly db: DatabaseSync) {}

  create({ name, status }: CreateProject, id: string = randomUUID()): Project {
    const now = new Date().toISOString();
    return this.db
      .prepare(
        `INSERT INTO projects (id, name, status, created_at, updated_at, workspace_id)
         VALUES (:id, :name, :status, :now, :now, :workspace_id)
         RETURNING *`,
      )
      .get({ id, name, status, now, workspace_id: WORKSPACE_ID }) as Project;
  }

  list({ limit, offset }: Page): Project[] {
    return this.db
      .prepare('SELECT * FROM projects ORDER BY created_at, rowid LIMIT :limit OFFSET :offset')
      .all({ limit, offset }) as Project[];
  }

  findById(id: string): Project | undefined {
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
  }

  getById(id: string): Project {
    const project = this.findById(id);
    if (!project) {
      throw new HttpError(404, `project ${id} not found`);
    }
    return project;
  }

  update(id: string, { name, status }: UpdateProject): Project {
    const project = this.db
      .prepare(
        `UPDATE projects
         SET name = COALESCE(:name, name), status = COALESCE(:status, status), updated_at = :now
         WHERE id = :id
         RETURNING *`,
      )
      .get({ id, name: name ?? null, status: status ?? null, now: new Date().toISOString() });
    if (!project) {
      throw new HttpError(404, `project ${id} not found`);
    }
    return project as Project;
  }

  delete(id: string): void {
    try {
      this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    } catch (err) {
      if (isForeignKeyError(err)) {
        throw new HttpError(409, `project ${id} still has issues`);
      }
      throw err;
    }
  }
}
