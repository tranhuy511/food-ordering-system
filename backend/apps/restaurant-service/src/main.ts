import { NestFactory } from '@nestjs/core';
import { RestaurantServiceModule } from './restaurant-service.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(RestaurantServiceModule);
    app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.RESTAURANT_PORT || 3001;

  await app.listen(port);

  console.log(`Restaurant Service is running on port ${port}`);
}

bootstrap();