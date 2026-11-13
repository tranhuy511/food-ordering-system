
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentsTable1794600000000
  implements MigrationInterface
{
  name = 'CreatePaymentsTable1794600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`payments\` (
        \`id\` varchar(36) NOT NULL,
        \`orderId\` varchar(36) NOT NULL,
        \`customerId\` varchar(36) NOT NULL,
        \`amount\` decimal(12,2) NOT NULL,
        \`paymentMethod\` varchar(30) NOT NULL DEFAULT 'online',
        \`status\` varchar(30) NOT NULL DEFAULT 'pending',
        \`transactionId\` varchar(100) NULL,
        \`failureReason\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
          ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE INDEX \`IDX_payments_orderId\`
      ON \`payments\` (\`orderId\`)
    `);

    await queryRunner.query(`
      CREATE INDEX \`IDX_payments_customerId\`
      ON \`payments\` (\`customerId\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `payments`');
  }
}
