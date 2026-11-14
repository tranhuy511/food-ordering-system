
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastPaymentAttemptToOrders1794800000001
  implements MigrationInterface
{
  name = 'AddLastPaymentAttemptToOrders1794800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
      ADD COLUMN lastPaymentAttempt INT UNSIGNED NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
      DROP COLUMN lastPaymentAttempt
    `);
  }
}
