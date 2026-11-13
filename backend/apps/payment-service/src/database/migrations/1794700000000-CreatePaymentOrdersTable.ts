import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentOrdersTable1794700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create payment_orders table.
    await queryRunner.query(`
      CREATE TABLE payment_orders (
        id VARCHAR(36) NOT NULL,
        orderId VARCHAR(36) NOT NULL,
        customerId VARCHAR(36) NOT NULL,
        activePaymentId VARCHAR(36) NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
          ON UPDATE CURRENT_TIMESTAMP(6),

        PRIMARY KEY (id),
        UNIQUE KEY UQ_payment_orders_orderId (orderId),
        KEY IDX_payment_orders_customerId (customerId)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Backfill existing payment records.
    // Prefer a successful payment; otherwise select the latest attempt.
    await queryRunner.query(`
      INSERT INTO payment_orders (
        id,
        orderId,
        customerId,
        activePaymentId,
        status,
        createdAt,
        updatedAt
      )
      SELECT
        UUID(),
        p.orderId,
        p.customerId,

        (
          SELECT p2.id
          FROM payments p2
          WHERE p2.orderId = p.orderId
          ORDER BY
            (p2.status = 'success') DESC,
            p2.createdAt DESC,
            p2.id DESC
          LIMIT 1
        ),

        CASE
          WHEN EXISTS (
            SELECT 1
            FROM payments p3
            WHERE p3.orderId = p.orderId
              AND p3.status = 'success'
          )
          THEN 'success'
          ELSE (
            SELECT p4.status
            FROM payments p4
            WHERE p4.orderId = p.orderId
            ORDER BY p4.createdAt DESC, p4.id DESC
            LIMIT 1
          )
        END,

        NOW(6),
        NOW(6)

      FROM payments p
      GROUP BY p.orderId, p.customerId;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only remove the table created by this migration.
    // Do not delete payment history.
    await queryRunner.query(`
      DROP TABLE IF EXISTS payment_orders;
    `);
  }
}
