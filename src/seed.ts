import { DB_PATH, openDb } from './db';
import { type Issue, IssuesService } from './issues/issues.service';
import { MembersService } from './members/members.service';
import { ProjectsService } from './projects/projects.service';

const db = openDb(DB_PATH);
const projects = new ProjectsService(db);
const issues = new IssuesService(db);
const members = new MembersService(db);

// Replaces all rows, so running the seed twice leaves the same data set instead of duplicates.
db.exec('BEGIN');
try {
  db.exec('DELETE FROM changes; DELETE FROM issues; DELETE FROM projects; DELETE FROM members;');

  const sync = projects.create({ name: 'Sync engine', status: 'active' });
  const billing = projects.create({ name: 'Billing', status: 'paused' });
  const onboarding = projects.create({ name: 'Onboarding', status: 'completed' });
  projects.create({ name: 'Mobile app', status: 'draft' });

  const seedIssues: [string, string, string, Issue['priority'], Issue['status'], string][] = [
    [
      'Base version per record',
      'Replace client timestamps.',
      'ada@example.com',
      'urgent',
      'in_progress',
      sync.id,
    ],
    [
      'Pull endpoint',
      'GET /sync/changes?after=N.',
      'alan@example.com',
      'normal',
      'backlog',
      sync.id,
    ],
    ['Change ledger', 'Store every pushed change.', 'grace@example.com', 'normal', 'done', sync.id],
    [
      'Invoice PDFs',
      'Render invoices on the server.',
      'linus@example.com',
      'normal',
      'cancelled',
      billing.id,
    ],
    [
      'Proration',
      'Mid-cycle plan changes.',
      'margaret@example.com',
      'urgent',
      'backlog',
      billing.id,
    ],
    [
      'Welcome email',
      'Send after the first login.',
      'dennis@example.com',
      'normal',
      'done',
      onboarding.id,
    ],
    [
      'Sample data',
      'Seed a demo workspace.',
      'barbara@example.com',
      'normal',
      'in_progress',
      onboarding.id,
    ],
  ];
  for (const [title, description, assignee_email, priority, status, project_id] of seedIssues) {
    issues.create({ title, description, assignee_email, priority, status, project_id });
  }

  members.create({ name: 'Ada Lovelace', status: 'active' });
  members.create({ name: 'Alan Turing', status: 'active' });
  members.create({ name: 'Grace Hopper', status: 'suspended' });
  members.create({ name: 'Linus Torvalds', status: 'invited' });

  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
} finally {
  db.close();
}

console.log(`Seeded ${DB_PATH}`);
