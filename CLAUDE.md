# sync-engine-slice

NestJS 12 on Fastify, TypeORM, Postgres 18, vitest. pnpm. ESM.

- `docker compose up -d` for the dev database; `pnpm dev` on port 3000, docs at `/docs`.
- `pnpm test -- --run` (needs Docker, starts its own Postgres); `pnpm typecheck`; `pnpm check`
  formats and lints (Biome).
- TypeScript 7 only type-checks; SWC compiles. No Nest CLI, no ts-node, no swc-node: `dev`, `seed`
  and the TypeORM CLI run the built `dist`.

## Code conventions

- A feature is a Nest module: controller, service, entity, DTOs. Services read and write through
  `TransactionHost.tx`; write endpoints are `@Transactional()`.
- Validation lives in DTOs (class-validator); the global `ValidationPipe` rejects unknown fields.
- Schema changes only through migrations in `src/database/migrations`; entities list explicit
  column types.
- Errors are Nest HTTP exceptions; response bodies carry data only.
- Relative imports end in `.js`.
- TypeScript: no `any`; `??` over `||`; braces on every block; named constants instead of magic
  numbers; an object parameter when a function takes several values of the same type; `getX`
  throws when missing, `findX` returns `undefined`; signal failure by throwing, not by returning
  `false`.
- Anything that can be delivered or retried twice must be idempotent.
- Comments only where the reason is not obvious from the code.
- Tests: `createTestApp()` and `truncateAll()` from `test/create-test-app.ts`; one app per file.
