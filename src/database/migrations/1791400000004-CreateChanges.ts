import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChanges1791400000004 implements MigrationInterface {
  name = 'CreateChanges1791400000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE change_model AS ENUM ('projects', 'issues', 'members')`);
    await queryRunner.query(`CREATE TYPE change_action AS ENUM ('create', 'update', 'delete')`);
    await queryRunner.query(
      `CREATE TYPE change_status AS ENUM ('pending', 'applied', 'superseded', 'rejected')`,
    );
    await queryRunner.query(`
      CREATE TABLE changes (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        model change_model NOT NULL,
        record_id uuid NOT NULL,
        action change_action NOT NULL,
        data jsonb,
        client_ts bigint NOT NULL,
        status change_status NOT NULL,
        applied jsonb,
        reason text,
        sync_id bigint UNIQUE,
        received_at timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX changes_pending_idx ON changes (id) WHERE status = 'pending'`,
    );
    await queryRunner.query('CREATE INDEX changes_record_idx ON changes (model, record_id)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE changes');
    await queryRunner.query('DROP TYPE change_status');
    await queryRunner.query('DROP TYPE change_action');
    await queryRunner.query('DROP TYPE change_model');
  }
}
