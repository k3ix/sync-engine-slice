import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { WORKSPACE_ID } from '../db';
import { HttpError } from '../http-error';
import type { Page } from '../schemas';

export const MEMBER_STATUSES = ['invited', 'active', 'suspended', 'deactivated'] as const;

export type Member = {
  id: string;
  name: string;
  status: (typeof MEMBER_STATUSES)[number];
  created_at: string;
  updated_at: string;
  workspace_id: string;
};

export type CreateMember = Pick<Member, 'name' | 'status'>;
export type UpdateMember = Partial<CreateMember>;

export class MembersService {
  constructor(private readonly db: DatabaseSync) {}

  create({ name, status }: CreateMember, id: string = randomUUID()): Member {
    const now = new Date().toISOString();
    return this.db
      .prepare(
        `INSERT INTO members (id, name, status, created_at, updated_at, workspace_id)
         VALUES (:id, :name, :status, :now, :now, :workspace_id)
         RETURNING *`,
      )
      .get({ id, name, status, now, workspace_id: WORKSPACE_ID }) as Member;
  }

  list({ limit, offset }: Page): Member[] {
    return this.db
      .prepare('SELECT * FROM members ORDER BY created_at, rowid LIMIT :limit OFFSET :offset')
      .all({ limit, offset }) as Member[];
  }

  findById(id: string): Member | undefined {
    return this.db.prepare('SELECT * FROM members WHERE id = ?').get(id) as Member | undefined;
  }

  getById(id: string): Member {
    const member = this.findById(id);
    if (!member) {
      throw new HttpError(404, `member ${id} not found`);
    }
    return member;
  }

  update(id: string, { name, status }: UpdateMember): Member {
    const member = this.db
      .prepare(
        `UPDATE members
         SET name = COALESCE(:name, name), status = COALESCE(:status, status), updated_at = :now
         WHERE id = :id
         RETURNING *`,
      )
      .get({ id, name: name ?? null, status: status ?? null, now: new Date().toISOString() });
    if (!member) {
      throw new HttpError(404, `member ${id} not found`);
    }
    return member as Member;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM members WHERE id = ?').run(id);
  }
}
