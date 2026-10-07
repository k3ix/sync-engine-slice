import { Injectable, NotFoundException } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Repository } from 'typeorm';
import type { Page } from '../common/page.types.js';
import { WORKSPACE_ID } from '../common/workspace.constants.js';
import { Member } from './member.entity.js';
import type { CreateMemberInput, UpdateMemberInput } from './members.types.js';

@Injectable()
export class MembersService {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  private get members(): Repository<Member> {
    return this.txHost.tx.getRepository(Member);
  }

  create(input: CreateMemberInput & { id?: string }): Promise<Member> {
    return this.members.save(this.members.create({ ...input, workspaceId: WORKSPACE_ID }));
  }

  list({ limit, offset }: Page): Promise<Member[]> {
    return this.members.find({
      order: { createdAt: 'ASC', id: 'ASC' },
      take: limit,
      skip: offset,
    });
  }

  async findById(id: string): Promise<Member | undefined> {
    return (await this.members.findOneBy({ id })) ?? undefined;
  }

  async getById(id: string): Promise<Member> {
    const member = await this.findById(id);
    if (!member) {
      throw new NotFoundException(`member ${id} not found`);
    }
    return member;
  }

  async update(id: string, patch: UpdateMemberInput): Promise<Member> {
    const member = await this.getById(id);
    await this.members.save(this.members.merge(member, patch));
    return this.getById(id);
  }

  async delete(id: string): Promise<void> {
    await this.members.delete({ id });
  }
}
