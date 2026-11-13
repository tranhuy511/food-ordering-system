import 'dotenv/config';

import { DataSource } from 'typeorm';

import { Notification } from '../notifications/entities/notification.entity';

export default new DataSource({
  type: 'mysql',

  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),

  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,

  entities: [
    Notification,
  ],

  migrations: [
    'apps/notification-service/src/database/migrations/*.ts',
  ],

  synchronize: false,
});
