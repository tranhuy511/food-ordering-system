
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';

import { OrderServiceModule } from './order-service.module';

async function bootstrap() {
  const app = await NestFactory.create(OrderServiceModule);

  const configService = app.get(ConfigService);

  const rabbitmqUrl =
    configService.get<string>('RABBITMQ_URL');

  if (!rabbitmqUrl) {
    throw new Error('Missing RABBITMQ_URL');
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // RabbitMQ consumer for payment events
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'food_payment_events',
      queueOptions: {
        durable: true,
      },
      noAck: false,
      prefetchCount: 1,
    },
  });

  // Start RabbitMQ consumer
  await app.startAllMicroservices();

  Logger.log('RabbitMQ consumer connected');
  Logger.log('Listening on queue: food_payment_events');

  // Start HTTP server
  const port = Number(
    configService.get<string>('PORT') || 3002,
  );

  await app.listen(port);

  Logger.log(
    `Order Service is running on port ${port}`,
  );
}

bootstrap();
