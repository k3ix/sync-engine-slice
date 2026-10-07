import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Repository } from 'typeorm';
import type { Page } from '../common/page.query.js';
import { WORKSPACE_ID } from '../common/workspace.constants.js';
import { isForeignKeyViolation } from '../database/foreign-key.js';
import { Project, type ProjectStatus } from './project.entity.js';

export type ProjectFields = { name: string; status: ProjectStatus };
export type CreateProjectInput = { name: string; status?: ProjectStatus };
export type UpdateProjectInput = Partial<ProjectFields>;

@Injectable()
export class ProjectsService {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  private get projects(): Repository<Project> {
    return this.txHost.tx.getRepository(Project);
  }

  create(input: CreateProjectInput & { id?: string }): Promise<Project> {
    return this.projects.save(this.projects.create({ ...input, workspaceId: WORKSPACE_ID }));
  }

  list({ limit, offset }: Page): Promise<Project[]> {
    return this.projects.find({
      order: { createdAt: 'ASC', id: 'ASC' },
      take: limit,
      skip: offset,
    });
  }

  async findById(id: string): Promise<Project | undefined> {
    return (await this.projects.findOneBy({ id })) ?? undefined;
  }

  async getById(id: string): Promise<Project> {
    const project = await this.findById(id);
    if (!project) {
      throw new NotFoundException(`project ${id} not found`);
    }
    return project;
  }

  async update(id: string, patch: UpdateProjectInput): Promise<Project> {
    const project = await this.getById(id);
    await this.projects.save(this.projects.merge(project, patch));
    return this.getById(id);
  }

  async delete(id: string): Promise<void> {
    try {
      await this.projects.delete({ id });
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new ConflictException(`project ${id} still has issues`);
      }
      throw err;
    }
  }
}
