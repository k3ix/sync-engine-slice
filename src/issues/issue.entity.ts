import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../projects/project.entity.js';

export const ISSUE_PRIORITIES = ['normal', 'urgent'] as const;
export const ISSUE_STATUSES = ['backlog', 'in_progress', 'done', 'cancelled'] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

@Entity('issues')
@Index('issues_project_id_idx', ['projectId'])
export class Issue {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text' })
  assigneeEmail: string;

  @Column({ type: 'enum', enum: ISSUE_PRIORITIES, enumName: 'issue_priority', default: 'normal' })
  priority: IssuePriority;

  @Column({ type: 'enum', enum: ISSUE_STATUSES, enumName: 'issue_status' })
  status: IssueStatus;

  @Column({ type: 'uuid' })
  projectId: string;

  // Declared only so the TypeORM schema diff knows the foreign key; nothing loads it.
  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id', foreignKeyConstraintName: 'issues_project_id_fkey' })
  project?: Relation<Project>;

  @Column({ type: 'text' })
  workspaceId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
