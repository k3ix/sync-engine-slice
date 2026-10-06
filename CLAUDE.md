# Workspace

Fastify 5 + TypeScript + vitest. pnpm.

- `pnpm test -- --run` runs tests once; `pnpm typecheck`; `pnpm check` formats and lints (Biome).
- `pnpm dev` starts the server on port 3000 with reload.

## How we work

- Before writing code, restate the task in two or three sentences, list the edge cases you see, and
  propose the steps. Wait for a go.
- Tests first for the agreed cases. Run them and show that they fail, then implement.
- One small step at a time. Keep each diff small enough to read in a minute. After each step, say
  what changed and why in a few lines, and run tests, typecheck and lint.
- Ask one question when something is ambiguous instead of guessing.
- Do not add a dependency without asking. Do not commit unless asked; before a commit, show
  `git status` and the diff.
- When unsure about a library API, read its README or types in `node_modules` instead of guessing.
- Reply in English, briefly.

## Code conventions

- `src/app.ts` exports `buildApp(opts)` and never listens. `src/server.ts` listens. Tests use
  `app.inject()`, no real port.
- A feature is a Fastify plugin with its routes, schemas and a service. Services are plain classes
  with no Fastify imports; dependencies are passed in and wired in one place.
- Validate with route schemas, not with checks in handlers.
- Errors are thrown with a `statusCode` and shaped in one `setErrorHandler`. Response bodies carry
  data only.
- TypeScript: no `any`; `??` over `||`; braces on every block; named constants instead of magic
  numbers; an object parameter when a function takes several values of the same type; `getX`
  throws when missing, `findX` returns `undefined`; signal failure by throwing, not by returning
  `false`.
- Anything that can be delivered or retried twice must be idempotent.
- Comments only where the reason is not obvious from the code.
