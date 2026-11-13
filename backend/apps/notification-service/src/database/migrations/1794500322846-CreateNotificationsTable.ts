import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationsTable1794500322846 implements MigrationInterface {
  name = 'CreateNotificationsTable1794500322846';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`notifications\` (\`id\` varchar(36) NOT NULL, \`orderId\` varchar(36) NOT NULL, \`customerId\` varchar(36) NOT NULL, \`eventType\` varchar(60) NOT NULL, \`title\` varchar(150) NOT NULL, \`message\` text NOT NULL, \`data\` json NULL, \`isRead\` tinyint NOT NULL DEFAULT 0, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_notifications_customer_created\` (\`customerId\`, \`createdAt\`), UNIQUE INDEX \`UQ_notifications_order_event\` (\`orderId\`, \`eventType\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`UQ_notifications_order_event\` ON \`notifications\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_notifications_customer_created\` ON \`notifications\``,
    );
    await queryRunner.query(`DROP TABLE \`notifications\``);
  }
}
