import 'dotenv/config';
import { DataSource } from 'typeorm';

import { Payment } from '../payments/entities/payment.entity';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,

  entities: [Payment],

  migrations: ['apps/payment-service/src/database/migrations/*.ts'],

  synchronize: false,
});
