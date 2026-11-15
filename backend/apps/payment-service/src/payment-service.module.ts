import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { Payment } from './payments/entities/payment.entity';
import { PaymentServiceController } from './payment-service.controller';
import { PaymentServiceService } from './payment-service.service';
import { AuthModule } from './auth/auth.module';
import { PaymentOrder } from './payments/entities/payment-order.entity';
import { PaymentOutboxEvent } from './outbox/payment-outbox-event.entity';
import { PaymentOutboxPublisherService } from './outbox/payment-outbox-publisher.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('DB_HOST'),
        port: Number(config.get<string>('DB_PORT', '3306')),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        charset: 'utf8mb4',
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),

    TypeOrmModule.forFeature([
      Payment,
      PaymentOrder,
      PaymentOutboxEvent,
    ]),

    ClientsModule.registerAsync([
      {
        name: 'PAYMENT_EVENTS',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
          const rabbitmqUrl = config.get<string>('RABBITMQ_URL');

          if (!rabbitmqUrl) {
            throw new Error('Missing RABBITMQ_URL');
          }

          return {
            transport: Transport.RMQ,
            options: {
              urls: [rabbitmqUrl],
              queue: 'food_payment_events',
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

  controllers: [PaymentServiceController],
    providers: [
    PaymentServiceService,
    PaymentOutboxPublisherService,
  ],
})
export class PaymentServiceModule {}
