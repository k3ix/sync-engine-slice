import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { PROJECT_STATUSES, type ProjectStatus } from './projects.types.js';

@Entity('projects')
export class Project {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'enum', enum: PROJECT_STATUSES, enumName: 'project_status', default: 'draft' })
  status: ProjectStatus;

  @Column({ type: 'text' })
  workspaceId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
