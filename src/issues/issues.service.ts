import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Repository } from 'typeorm';
import type { Page } from '../common/page.query.js';
import { WORKSPACE_ID } from '../common/workspace.constants.js';
import { isForeignKeyViolation } from '../database/foreign-key.js';
import { Issue, type IssuePriority, type IssueStatus } from './issue.entity.js';

export type IssueFields = {
  title: string;
  description: string;
  assigneeEmail: string;
  priority: IssuePriority;
  status: IssueStatus;
  projectId: string;
};
export type CreateIssueInput = Omit<IssueFields, 'priority'> & { priority?: IssuePriority };
export type UpdateIssueInput = Partial<IssueFields>;
export type ListIssues = Page & { projectId?: string };

@Injectable()
export class IssuesService {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  private get issues(): Repository<Issue> {
    return this.txHost.tx.getRepository(Issue);
  }

  create(input: CreateIssueInput & { id?: string }): Promise<Issue> {
    return this.withProjectCheck(input.projectId, () =>
      this.issues.save(this.issues.create({ ...input, workspaceId: WORKSPACE_ID })),
    );
  }

  list({ limit, offset, projectId }: ListIssues): Promise<Issue[]> {
    return this.issues.find({
      where: projectId === undefined ? {} : { projectId },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: limit,
      skip: offset,
    });
  }

  async findById(id: string): Promise<Issue | undefined> {
    return (await this.issues.findOneBy({ id })) ?? undefined;
  }

  async getById(id: string): Promise<Issue> {
    const issue = await this.findById(id);
    if (!issue) {
      throw new NotFoundException(`issue ${id} not found`);
    }
    return issue;
  }

  async update(id: string, patch: UpdateIssueInput): Promise<Issue> {
    const issue = await this.getById(id);
    await this.withProjectCheck(patch.projectId, () =>
      this.issues.save(this.issues.merge(issue, patch)),
    );
    return this.getById(id);
  }

  async delete(id: string): Promise<void> {
    await this.issues.delete({ id });
  }

  private async withProjectCheck<T>(
    projectId: string | undefined,
    write: () => Promise<T>,
  ): Promise<T> {
    try {
      return await write();
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new BadRequestException(`project ${projectId} does not exist`);
      }
      throw err;
    }
  }
}
