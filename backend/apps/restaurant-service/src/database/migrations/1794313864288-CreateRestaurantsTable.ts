import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRestaurantsTable1794313864288 implements MigrationInterface {
    name = 'CreateRestaurantsTable1794313864288'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`restaurants\` (\`id\` varchar(36) NOT NULL, \`name\` varchar(150) NOT NULL, \`description\` text NULL, \`address\` varchar(255) NOT NULL, \`phone\` varchar(20) NOT NULL, \`email\` varchar(150) NULL, \`imageUrl\` varchar(500) NULL, \`ownerId\` varchar(36) NOT NULL, \`status\` varchar(30) NOT NULL DEFAULT 'pending', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`restaurants\``);
    }

}
