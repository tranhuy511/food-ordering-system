
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AuthModule } from '../auth/auth.module';
import { OrdersEventsController } from './orders.events.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
    ]),

    ConfigModule,

    ClientsModule.registerAsync([
      {
        name: 'ORDER_EVENTS',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const rabbitmqUrl =
            configService.get<string>('RABBITMQ_URL');

          if (!rabbitmqUrl) {
            throw new Error('Missing RABBITMQ_URL');
          }

          return {
            transport: Transport.RMQ,
            options: {
              urls: [rabbitmqUrl],
              queue: 'food_order_events',
              queueOptions: {
                durable: true,
              },
            },
          };
        },
      },
    ]),

    AuthModule,
  ],
  controllers: [
    OrdersController,
    OrdersEventsController,
  ],
  providers: [OrdersService],
})
export class OrdersModule {}
