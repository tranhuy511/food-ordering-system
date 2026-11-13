import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrdersTables1794408241937 implements MigrationInterface {
    name = 'CreateOrdersTables1794408241937'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`order_items\` (\`id\` varchar(36) NOT NULL, \`productId\` varchar(36) NOT NULL, \`productName\` varchar(150) NOT NULL, \`unitPrice\` decimal(12,2) NOT NULL, \`quantity\` int UNSIGNED NOT NULL, \`subtotal\` decimal(12,2) NOT NULL, \`orderId\` varchar(36) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`orders\` (\`id\` varchar(36) NOT NULL, \`customerId\` varchar(36) NOT NULL, \`restaurantId\` varchar(36) NOT NULL, \`status\` varchar(30) NOT NULL DEFAULT 'pending', \`paymentStatus\` varchar(30) NOT NULL DEFAULT 'pending', \`paymentMethod\` varchar(30) NOT NULL DEFAULT 'cash', \`deliveryAddress\` varchar(255) NOT NULL, \`note\` text NULL, \`totalAmount\` decimal(12,2) NOT NULL DEFAULT '0.00', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`order_items\` ADD CONSTRAINT \`FK_f1d359a55923bb45b057fbdab0d\` FOREIGN KEY (\`orderId\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`order_items\` DROP FOREIGN KEY \`FK_f1d359a55923bb45b057fbdab0d\``);
        await queryRunner.query(`DROP TABLE \`orders\``);
        await queryRunner.query(`DROP TABLE \`order_items\``);
    }

}
