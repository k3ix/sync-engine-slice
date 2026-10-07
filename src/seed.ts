import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { AppModule } from './app.module.js';
import { type CreateIssueInput, IssuesService } from './issues/issues.service.js';
import { MembersService } from './members/members.service.js';
import { ProjectsService } from './projects/projects.service.js';

const app = await NestFactory.createApplicationContext(AppModule);
const txHost = app.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost);
const projects = app.get(ProjectsService);
const issues = app.get(IssuesService);
const members = app.get(MembersService);

// Replaces all rows, so running the seed twice leaves the same data set instead of duplicates.
await txHost.withTransaction(async () => {
  await txHost.tx.query('TRUNCATE changes, issues, projects, members RESTART IDENTITY');

  const sync = await projects.create({ name: 'Sync engine', status: 'active' });
  const billing = await projects.create({ name: 'Billing', status: 'paused' });
  await projects.create({ name: 'Onboarding', status: 'completed' });
  await projects.create({ name: 'Mobile app', status: 'draft' });

  const seedIssues: CreateIssueInput[] = [
    {
      title: 'Base version per record',
      description: 'Replace client timestamps.',
      assigneeEmail: 'ada@example.com',
      priority: 'urgent',
      status: 'in_progress',
      projectId: sync.id,
    },
    {
      title: 'Pull endpoint',
      description: 'GET /sync/changes?after=N.',
      assigneeEmail: 'alan@example.com',
      status: 'backlog',
      projectId: sync.id,
    },
    {
      title: 'Change ledger',
      description: 'Store every pushed change.',
      assigneeEmail: 'grace@example.com',
      status: 'done',
      projectId: sync.id,
    },
    {
      title: 'Invoice PDFs',
      description: 'Render invoices on the server.',
      assigneeEmail: 'ada@example.com',
      status: 'cancelled',
      projectId: billing.id,
    },
  ];
  for (const issue of seedIssues) {
    await issues.create(issue);
  }

  for (const [name, status] of [
    ['Ada Lovelace', 'active'],
    ['Alan Turing', 'active'],
    ['Grace Hopper', 'invited'],
  ] as const) {
    await members.create({ name, status });
  }
});

await app.close();
