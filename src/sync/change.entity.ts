import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer } from '../database/bigint.transformer.js';
import { ACTIONS, type Action, type Fields, MODELS, type Model } from './sync.types.js';

export const CHANGE_STATUSES = ['pending', 'applied', 'superseded', 'rejected'] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

@Entity('changes')
@Index('changes_pending_idx', ['id'], { where: `status = 'pending'` })
@Index('changes_record_idx', ['model', 'recordId'])
export class Change {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'enum', enum: MODELS, enumName: 'change_model' })
  model: Model;

  @Column({ type: 'uuid' })
  recordId: string;

  @Column({ type: 'enum', enum: ACTIONS, enumName: 'change_action' })
  action: Action;

  @Column({ type: 'jsonb', nullable: true })
  data: Fields | null;

  @Column({ type: 'bigint', transformer: bigintTransformer })
  clientTs: number;

  @Column({ type: 'enum', enum: CHANGE_STATUSES, enumName: 'change_status' })
  status: ChangeStatus;

  @Column({ type: 'jsonb', nullable: true })
  applied: Fields | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'bigint', nullable: true, unique: true, transformer: bigintTransformer })
  syncId: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  receivedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
