import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjects1791400000001 implements MigrationInterface {
  name = 'CreateProjects1791400000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE project_status AS ENUM ('draft', 'active', 'paused', 'completed')`,
    );
    await queryRunner.query(`
      CREATE TABLE projects (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL,
        status project_status NOT NULL DEFAULT 'draft',
        workspace_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE projects');
    await queryRunner.query('DROP TYPE project_status');
  }
}
