import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { NotificationServiceModule } from './notification-service.module';

async function bootstrap() {
  const app = await NestFactory.create(NotificationServiceModule);

  const configService = app.get(ConfigService);

  const rabbitmqUrl = configService.get<string>('RABBITMQ_URL');

  if (!rabbitmqUrl) {
    throw new Error('Missing RABBITMQ_URL');
  }

  // RabbitMQ microservice configuration
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'food_order_events',
      queueOptions: {
        durable: true,
      },
      noAck: false,
      prefetchCount: 1,
    },
  });

  // Start RabbitMQ consumer
  await app.startAllMicroservices();

  // Start HTTP server
  const port = Number(
    configService.get<string>('NOTIFICATION_SERVICE_PORT') || 3004,
  );

  await app.listen(port);

  Logger.log(`Notification Service HTTP running at http://localhost:${port}`);

  Logger.log('RabbitMQ consumer connected');
}

bootstrap();
