# sync-engine-slice

The write half of a Linear-style sync engine. NestJS 12 on Fastify, TypeORM, Postgres 18,
vitest.

The client keeps its own copy of the data, applies every change locally first, and pushes it to
the backend without waiting. The backend stores each change, applies it later in a worker, and
gives every applied change a gapless `sync_id` in the same commit as the data write. Changes
arriving out of order are resolved per field by the client timestamp of the event, not by
arrival order.

## What is here

- `POST /sync/changes`: a batch of up to 100 create / update / delete changes for `projects`,
  `issues` or `members`, validated by DTOs that reuse each resource's own field DTOs. Answers
  `202` once stored; a malformed batch is rejected whole with `400`.
- `changes` table: one ledger for received and processed changes, with `pending`, `applied`,
  `superseded` and `rejected` rows and the reason for each outcome.
- `SyncWorker`: processes pending rows in arrival order, one transaction per change, one drain
  loop per process. Per-field conflict resolution against the record's applied history, delete
  always wins, replays are superseded, business rejections are recorded, unexpected errors leave
  the row pending.
- REST CRUD for the three resources, one Nest module each.
- OpenAPI docs at `/docs`.
- Tests against a real Postgres started by Testcontainers.

The design, the resolution table and the known limitations are in
[docs/sync-design.md](docs/sync-design.md).

## Run

```
pnpm install
cp .env.example .env
docker compose up -d
pnpm seed          # example data
pnpm dev           # http://localhost:3000, docs at /docs
pnpm test -- --run # needs Docker
```

## Known limitations

Written down rather than hidden: conflicts are decided by client clocks, which the client
controls (a deliberate shortcut; the next step is a base version per record); REST writes bypass
the ledger; one drain loop per process, so ordering across several processes is not handled yet;
resolution reads the record's whole applied history per change; one unexpected error stops the
queue until it is fixed. Polling and notifying the sender about rejections are the next phase.
