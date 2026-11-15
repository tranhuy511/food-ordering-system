
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentOutboxEvents1794900000002
  implements MigrationInterface
{
  name = 'CreatePaymentOutboxEvents1794900000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE payment_outbox_events (
        id VARCHAR(36) NOT NULL,

        eventType VARCHAR(100) NOT NULL,
        aggregateId VARCHAR(36) NOT NULL,
        payload JSON NOT NULL,

        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        retryCount INT UNSIGNED NOT NULL DEFAULT 0,

        nextAttemptAt DATETIME(6) NOT NULL
          DEFAULT CURRENT_TIMESTAMP(6),

        lockedAt DATETIME(6) NULL,
        lockedBy VARCHAR(100) NULL,
        lastError TEXT NULL,

        createdAt DATETIME(6) NOT NULL
          DEFAULT CURRENT_TIMESTAMP(6),

        publishedAt DATETIME(6) NULL,

        PRIMARY KEY (id),

        INDEX IDX_payment_outbox_pending_schedule (
          status,
          nextAttemptAt,
          createdAt
        ),

        INDEX IDX_payment_outbox_processing_lease (
          status,
          lockedAt
        ),

        INDEX IDX_payment_outbox_aggregate (
          aggregateId
        )
      )
      ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS payment_outbox_events;
    `);
  }
}
