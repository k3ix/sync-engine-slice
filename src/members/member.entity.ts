import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { MEMBER_STATUSES, type MemberStatus } from './members.types.js';

@Entity('members')
export class Member {
  @PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' })
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'enum', enum: MEMBER_STATUSES, enumName: 'member_status', default: 'invited' })
  status: MemberStatus;

  @Column({ type: 'text' })
  workspaceId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
