import { Injectable } from '@nestjs/common';
import { Propagation, Transactional, TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Repository } from 'typeorm';
import { Change } from './change.entity.js';
import type { ChangeInput, Fields, Model } from './sync.types.js';

export type AppliedChange = Pick<Change, 'action' | 'clientTs' | 'applied'>;

@Injectable()
export class ChangesService {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  private get changes(): Repository<Change> {
    return this.txHost.tx.getRepository(Change);
  }

  async insertBatch(changes: ChangeInput[]): Promise<void> {
    await this.changes.insert(
      changes.map((change) => ({
        model: change.model,
        recordId: change.recordId,
        action: change.action,
        data: change.data ?? null,
        clientTs: change.clientTimestamp,
        status: 'pending' as const,
      })),
    );
  }

  async findNextPending(): Promise<Change | undefined> {
    return (
      (await this.changes.findOne({ where: { status: 'pending' }, order: { id: 'ASC' } })) ??
      undefined
    );
  }

  listApplied({ model, recordId }: { model: Model; recordId: string }): Promise<AppliedChange[]> {
    return this.changes.find({
      select: { action: true, clientTs: true, applied: true },
      where: { model, recordId, status: 'applied' },
      order: { syncId: 'ASC' },
    });
  }

  // Mandatory: the sync id must commit together with the data write it numbers.
  @Transactional(Propagation.Mandatory)
  async markApplied({ id, applied }: { id: number; applied: Fields | null }): Promise<void> {
    await this.changes
      .createQueryBuilder()
      .update(Change)
      .set({
        status: 'applied',
        applied,
        processedAt: () => 'now()',
        syncId: () => '(SELECT COALESCE(MAX(sync_id), 0) + 1 FROM changes)',
      })
      .where({ id })
      .execute();
  }

  @Transactional(Propagation.Mandatory)
  async markSkipped({
    id,
    status,
    reason,
  }: {
    id: number;
    status: 'superseded' | 'rejected';
    reason: string;
  }): Promise<void> {
    await this.changes.update({ id }, { status, reason, processedAt: () => 'now()' });
  }
}
