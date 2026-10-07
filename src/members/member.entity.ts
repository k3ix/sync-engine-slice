import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export const MEMBER_STATUSES = ['invited', 'active', 'suspended', 'deactivated'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

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
