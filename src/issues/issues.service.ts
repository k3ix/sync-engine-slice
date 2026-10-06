import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { isForeignKeyError, WORKSPACE_ID } from '../db';
import { HttpError } from '../http-error';
import type { Page } from '../schemas';

export const ISSUE_PRIORITIES = ['normal', 'urgent'] as const;
export const ISSUE_STATUSES = ['backlog', 'in_progress', 'done', 'cancelled'] as const;

export type Issue = {
  id: string;
  title: string;
  description: string;
  assignee_email: string;
  priority: (typeof ISSUE_PRIORITIES)[number];
  status: (typeof ISSUE_STATUSES)[number];
  project_id: string;
  created_at: string;
  updated_at: string;
  workspace_id: string;
};

export type CreateIssue = Pick<
  Issue,
  'title' | 'description' | 'assignee_email' | 'priority' | 'status' | 'project_id'
>;
export type UpdateIssue = Partial<CreateIssue>;
export type ListIssues = Page & { project_id?: string };

export class IssuesService {
  constructor(private readonly db: DatabaseSync) {}

  create(input: CreateIssue, id: string = randomUUID()): Issue {
    const now = new Date().toISOString();
    return this.withProjectCheck(
      input.project_id,
      () =>
        this.db
          .prepare(
            `INSERT INTO issues
               (id, title, description, assignee_email, priority, status, project_id,
                created_at, updated_at, workspace_id)
             VALUES
               (:id, :title, :description, :assignee_email, :priority, :status, :project_id,
                :now, :now, :workspace_id)
             RETURNING *`,
          )
          .get({
            id,
            title: input.title,
            description: input.description,
            assignee_email: input.assignee_email,
            priority: input.priority,
            status: input.status,
            project_id: input.project_id,
            now,
            workspace_id: WORKSPACE_ID,
          }) as Issue,
    );
  }

  list({ limit, offset, project_id }: ListIssues): Issue[] {
    return this.db
      .prepare(
        `SELECT * FROM issues
         WHERE :project_id IS NULL OR project_id = :project_id
         ORDER BY created_at, rowid
         LIMIT :limit OFFSET :offset`,
      )
      .all({ limit, offset, project_id: project_id ?? null }) as Issue[];
  }

  findById(id: string): Issue | undefined {
    return this.db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as Issue | undefined;
  }

  getById(id: string): Issue {
    const issue = this.findById(id);
    if (!issue) {
      throw new HttpError(404, `issue ${id} not found`);
    }
    return issue;
  }

  update(id: string, patch: UpdateIssue): Issue {
    const issue = this.withProjectCheck(patch.project_id, () =>
      this.db
        .prepare(
          `UPDATE issues
           SET title = COALESCE(:title, title),
               description = COALESCE(:description, description),
               assignee_email = COALESCE(:assignee_email, assignee_email),
               priority = COALESCE(:priority, priority),
               status = COALESCE(:status, status),
               project_id = COALESCE(:project_id, project_id),
               updated_at = :now
           WHERE id = :id
           RETURNING *`,
        )
        .get({
          id,
          title: patch.title ?? null,
          description: patch.description ?? null,
          assignee_email: patch.assignee_email ?? null,
          priority: patch.priority ?? null,
          status: patch.status ?? null,
          project_id: patch.project_id ?? null,
          now: new Date().toISOString(),
        }),
    );
    if (!issue) {
      throw new HttpError(404, `issue ${id} not found`);
    }
    return issue as Issue;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM issues WHERE id = ?').run(id);
  }

  private withProjectCheck<T>(projectId: string | undefined, fn: () => T): T {
    try {
      return fn();
    } catch (err) {
      if (isForeignKeyError(err)) {
        throw new HttpError(400, `project ${projectId} does not exist`);
      }
      throw err;
    }
  }
}
