
import {
  Controller,
  Logger,
} from '@nestjs/common';
import {
  EventPattern,
  Payload,
} from '@nestjs/microservices';

import { OrdersService } from './orders.service';

@Controller()
export class OrdersEventsController {
  private readonly logger = new Logger(
    OrdersEventsController.name,
  );

  constructor(
    private readonly ordersService: OrdersService,
  ) {}

  @EventPattern('payment.completed')
  async handlePaymentCompleted(
    @Payload() event: {
      paymentId: string;
      orderId: string;
      customerId: string;
      amount: string;
      transactionId?: string;
    },
  ) {
    this.logger.log(
      `Received payment.completed: ${event.orderId}`,
    );

    await this.ordersService.handlePaymentCompleted(event);
  }

  @EventPattern('payment.failed')
  async handlePaymentFailed(
    @Payload() event: {
      paymentId: string;
      orderId: string;
      customerId: string;
      amount: string;
      failureReason?: string;
    },
  ) {
    this.logger.warn(
      `Received payment.failed: ${event.orderId}`,
    );

    await this.ordersService.handlePaymentFailed(event);
  }
}
