import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMembers1791400000002 implements MigrationInterface {
  name = 'CreateMembers1791400000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE member_status AS ENUM ('invited', 'active', 'suspended', 'deactivated')`,
    );
    await queryRunner.query(`
      CREATE TABLE members (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL,
        status member_status NOT NULL DEFAULT 'invited',
        workspace_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE members');
    await queryRunner.query('DROP TYPE member_status');
  }
}
