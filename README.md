# sync-engine-slice

The write half of a Linear-style sync engine. Fastify 5, TypeScript, SQLite (`node:sqlite`), vitest.
No other dependencies.

The client keeps its own copy of the data, applies every change locally first, and pushes it to the
backend without waiting. The backend stores each change, applies it later in a worker, and gives
every applied change a gapless `sync_id` in the same commit as the data write. Changes arriving out
of order are resolved per field by the client timestamp of the event, not by arrival order.

## What is here

- `POST /sync/changes`: a batch of up to 100 create / update / delete changes for `projects`,
  `issues` or `members`, validated by a route schema built from the resources' own field schemas.
  Answers `202` once stored; a malformed batch is rejected whole with `400`.
- `changes` table: one ledger for received and processed changes, with `pending`, `applied`,
  `superseded` and `rejected` rows and the reason for each outcome.
- `SyncWorker.drain()`: processes pending rows in arrival order, one transaction per change.
  Per-field conflict resolution against the record's applied history, delete always wins, replays
  are superseded, business rejections are recorded, unexpected errors leave the row pending.
- Plain REST CRUD for the three resources, each a Fastify plugin with routes, schemas and a service
  class with no Fastify imports.
- 53 tests: worker tests on an in-memory database for every resolution rule, API tests through
  `app.inject()`.

The design, the resolution table and the known limitations are in [docs/sync-design.md](docs/sync-design.md).

## Run

```
pnpm install
pnpm seed          # example data in data.db
pnpm dev           # http://localhost:3000
pnpm test -- --run
```

## Known limitations

Written down rather than hidden: REST writes bypass the ledger; the drain is synchronous and a large
backlog would block the event loop; resolution reads the record's whole applied history per change;
`MAX(sync_id) + 1` is safe only because SQLite has a single writer; one unexpected error stops the
queue until it is fixed. Polling and notifying the sender about rejections are the next phase.
