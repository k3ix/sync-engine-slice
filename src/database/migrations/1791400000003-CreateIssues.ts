import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIssues1791400000003 implements MigrationInterface {
  name = 'CreateIssues1791400000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE issue_priority AS ENUM ('normal', 'urgent')`);
    await queryRunner.query(
      `CREATE TYPE issue_status AS ENUM ('backlog', 'in_progress', 'done', 'cancelled')`,
    );
    await queryRunner.query(`
      CREATE TABLE issues (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        title text NOT NULL,
        description text NOT NULL,
        assignee_email text NOT NULL,
        priority issue_priority NOT NULL DEFAULT 'normal',
        status issue_status NOT NULL,
        project_id uuid NOT NULL,
        workspace_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT issues_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id)
      )
    `);
    await queryRunner.query('CREATE INDEX issues_project_id_idx ON issues (project_id)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE issues');
    await queryRunner.query('DROP TYPE issue_status');
    await queryRunner.query('DROP TYPE issue_priority');
  }
}
