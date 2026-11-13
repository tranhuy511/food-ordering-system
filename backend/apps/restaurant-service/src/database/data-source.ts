import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Restaurant } from '../restaurants/entities/restaurant.entity';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [Restaurant],
  migrations: ['apps/restaurant-service/src/database/migrations/*.ts'],
  synchronize: false,
});
