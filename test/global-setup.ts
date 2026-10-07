import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let container: StartedPostgreSqlContainer;

export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer('postgres:18').start();
  project.provide('databaseUrl', container.getConnectionUri());
}

export async function teardown(): Promise<void> {
  await container.stop();
}
