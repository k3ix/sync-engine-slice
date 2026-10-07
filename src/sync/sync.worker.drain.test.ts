import { Logger } from '@nestjs/common';
import type { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { ChangesService } from './changes.service.js';
import type { Model, SyncTarget } from './sync.types.js';
import { SyncWorker } from './sync.worker.js';

const MICROTASK_OFFSETS = 40;

type Fakes = {
  changes: Partial<ChangesService>;
  txHost: Partial<TransactionHost<TransactionalAdapterTypeOrm>>;
};

function workerWith({ changes, txHost }: Fakes): SyncWorker {
  // The fakes implement only what drain() touches.
  return new SyncWorker(
    changes as unknown as ChangesService,
    txHost as unknown as TransactionHost<TransactionalAdapterTypeOrm>,
    {} as Record<Model, SyncTarget>,
  );
}

function queueWorker(queue: number[]): SyncWorker {
  return workerWith({
    changes: {
      findNextPending: async () => (queue.length > 0 ? ({ id: queue[0] } as never) : undefined),
    },
    txHost: {
      withTransaction: (async () => {
        queue.shift();
      }) as never,
    },
  });
}

describe('SyncWorker.drain', () => {
  it('logs and resolves when reading the queue fails', async () => {
    const loggedError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const worker = workerWith({
      changes: {
        findNextPending: async () => {
          throw new Error('db down');
        },
      },
      txHost: {},
    });

    await expect(worker.drain()).resolves.toBeUndefined();
    expect(loggedError).toHaveBeenCalledOnce();
    loggedError.mockRestore();
  });

  it('processes a change pushed at any point while a drain is finishing', async () => {
    for (let offset = 0; offset < MICROTASK_OFFSETS; offset++) {
      const queue: number[] = [];
      const worker = queueWorker(queue);
      const first = worker.drain();
      for (let tick = 0; tick < offset; tick++) {
        await Promise.resolve();
      }

      queue.push(1);
      void worker.drain();
      await first;
      await worker.idle();

      expect({ offset, pending: queue.length }).toEqual({ offset, pending: 0 });
    }
  });
});
