
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentAttemptNumber1794800000000
  implements MigrationInterface
{
  name = 'AddPaymentAttemptNumber1794800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add attemptNumber to payments.
    await queryRunner.query(`
      ALTER TABLE payments
      ADD COLUMN attemptNumber INT UNSIGNED NOT NULL DEFAULT 1
    `);

    // Backfill payment attempts in chronological order.
    await queryRunner.query(`
      UPDATE payments p
      JOIN (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY orderId
            ORDER BY createdAt ASC, id ASC
          ) AS attemptNumber
        FROM payments
      ) ranked ON ranked.id = p.id
      SET p.attemptNumber = ranked.attemptNumber
    `);

    // Add attempt counter to payment_orders.
    await queryRunner.query(`
      ALTER TABLE payment_orders
      ADD COLUMN attemptNumber INT UNSIGNED NOT NULL DEFAULT 0
    `);

    // Backfill the total number of attempts per order.
    await queryRunner.query(`
      UPDATE payment_orders po
      SET attemptNumber = (
        SELECT COUNT(*)
        FROM payments p
        WHERE p.orderId = po.orderId
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payment_orders
      DROP COLUMN attemptNumber
    `);

    await queryRunner.query(`
      ALTER TABLE payments
      DROP COLUMN attemptNumber
    `);
  }
}
