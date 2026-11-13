import 'dotenv/config';
import { DataSource } from 'typeorm';

import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,

  entities: [Order, OrderItem],

  migrations: ['apps/order-service/src/database/migrations/*.ts'],

  synchronize: false,
});
