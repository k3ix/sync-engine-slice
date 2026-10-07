import {
  type BeforeApplicationShutdown,
  HttpException,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { Change } from './change.entity.js';
import { type AppliedChange, ChangesService } from './changes.service.js';
import { type Fields, type Model, SYNC_TARGETS, type SyncTarget } from './sync.types.js';

// A field wins only if every applied write to it is strictly older, so a replay (same timestamp) loses.
export function winningFields(data: Fields, clientTs: number, history: AppliedChange[]): Fields {
  return Object.fromEntries(
    Object.entries(data).filter(([field]) =>
      history.every(
        (entry) => !entry.applied || !(field in entry.applied) || entry.clientTs < clientTs,
      ),
    ),
  );
}

@Injectable()
export class SyncWorker implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(SyncWorker.name);
  private running: Promise<void> | undefined;
  private rerun = false;

  constructor(
    private readonly changes: ChangesService,
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    @Inject(SYNC_TARGETS) private readonly targets: Record<Model, SyncTarget>,
  ) {}

  onApplicationBootstrap(): void {
    void this.drain();
  }

  beforeApplicationShutdown(): Promise<void> {
    return this.idle();
  }

  idle(): Promise<void> {
    return this.running ?? Promise.resolve();
  }

  // One loop per process: two interleaved loops would apply a change twice or reuse a sync id.
  drain(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = this.loop()
      .catch((error: unknown) => {
        this.logger.error({
          msg: 'Sync drain failed; pending changes wait for the next drain',
          error,
        });
      })
      .finally(() => {
        this.running = undefined;
        if (this.rerun) {
          void this.drain();
        }
      });
    return this.running;
  }

  private async loop(): Promise<void> {
    do {
      this.rerun = false;
      let change = await this.changes.findNextPending();
      while (change) {
        try {
          await this.process(change);
        } catch (error) {
          this.logger.error({
            msg: 'Sync drain stopped; the change stays pending',
            changeId: change.id,
            error,
          });
          return;
        }
        change = await this.changes.findNextPending();
      }
    } while (this.rerun);
  }

  private async process(change: Change): Promise<void> {
    try {
      await this.txHost.withTransaction(() => this.apply(change));
    } catch (error) {
      if (!(error instanceof HttpException)) {
        throw error;
      }
      // Postgres aborts the failed transaction, so the rejection is recorded in a new one.
      await this.txHost.withTransaction(() =>
        this.changes.markSkipped({ id: change.id, status: 'rejected', reason: error.message }),
      );
    }
  }

  private async apply({ id, model, recordId, action, data, clientTs }: Change): Promise<void> {
    const history = await this.changes.listApplied({ model, recordId });
    if (history.some((entry) => entry.action === 'delete')) {
      await this.changes.markSkipped({ id, status: 'superseded', reason: 'deleted' });
      return;
    }

    const target = this.targets[model];
    const exists = (await target.findById(recordId)) !== undefined;

    if (action === 'create') {
      if (exists) {
        await this.changes.markSkipped({ id, status: 'superseded', reason: 'already exists' });
        return;
      }
      await target.create({ ...data, id: recordId });
      await this.changes.markApplied({ id, applied: data });
      return;
    }

    if (!exists) {
      await this.changes.markSkipped({ id, status: 'rejected', reason: 'not found' });
      return;
    }

    if (action === 'delete') {
      await target.delete(recordId);
      await this.changes.markApplied({ id, applied: null });
      return;
    }

    const fields = winningFields(data ?? {}, clientTs, history);
    if (Object.keys(fields).length === 0) {
      await this.changes.markSkipped({
        id,
        status: 'superseded',
        reason: 'older than applied changes',
      });
      return;
    }
    await target.update(recordId, fields);
    await this.changes.markApplied({ id, applied: fields });
  }
}
