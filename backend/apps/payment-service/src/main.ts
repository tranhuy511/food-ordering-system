import { NestFactory } from '@nestjs/core';
import { PaymentServiceModule } from './payment-service.module';

async function bootstrap() {
  const app = await NestFactory.create(PaymentServiceModule);

  const port = Number(process.env.PAYMENT_SERVICE_PORT || 3003);

  await app.listen(port);

  console.log(`Payment Service running at http://localhost:${port}`);
}

bootstrap();
