import { Controller, Logger } from '@nestjs/common';

import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';

import { OrdersService } from './orders.service';

interface PaymentEventPayload {
  paymentId: string;
  orderId: string;
  customerId: string;
  amount: string;
  attemptNumber: number;
  transactionId?: string;
  failureReason?: string;
}

@Controller()
export class OrdersEventsController {
  private readonly logger = new Logger(OrdersEventsController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @EventPattern('payment.completed')
  async handlePaymentCompleted(
    @Payload() event: PaymentEventPayload,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const message = context.getMessage();

    try {
      this.logger.log(
        `Received payment.completed: ${event.orderId}, ` +
          `attempt ${event.attemptNumber}`,
      );

      await this.ordersService.handlePaymentCompleted(event);

      channel.ack(message);

      this.logger.log(
        `ACK payment.completed: ${event.orderId}, ` +
          `attempt ${event.attemptNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed payment.completed: ${event.orderId}`,
        error instanceof Error ? error.stack : String(error),
      );

      channel.nack(message, false, true);
    }
  }

  @EventPattern('payment.failed')
  async handlePaymentFailed(
    @Payload() event: PaymentEventPayload,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const message = context.getMessage();

    try {
      this.logger.warn(
        `Received payment.failed: ${event.orderId}, ` +
          `attempt ${event.attemptNumber}`,
      );

      await this.ordersService.handlePaymentFailed(event);

      channel.ack(message);

      this.logger.log(
        `ACK payment.failed: ${event.orderId}, ` +
          `attempt ${event.attemptNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed payment.failed: ${event.orderId}`,
        error instanceof Error ? error.stack : String(error),
      );

      channel.nack(message, false, true);
    }
  }
}
