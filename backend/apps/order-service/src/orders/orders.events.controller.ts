import { Controller, Logger } from '@nestjs/common';

import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';

import { OrdersService } from './orders.service';

@Controller()
export class OrdersEventsController {
  private readonly logger = new Logger(OrdersEventsController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @EventPattern('payment.completed')
  async handlePaymentCompleted(
    @Payload()
    event: {
      paymentId: string;
      orderId: string;
      customerId: string;
      amount: string;
      transactionId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const message = context.getMessage();

    try {
      this.logger.log(`Received payment.completed: ${event.orderId}`);

      await this.ordersService.handlePaymentCompleted(event);

      // ACK sau khi xử lý thành công
      channel.ack(message);

      this.logger.log(`ACK payment.completed: ${event.orderId}`);
    } catch (error) {
      this.logger.error(
        `Failed payment.completed: ${event.orderId}`,
        error instanceof Error ? error.stack : String(error),
      );

      // Không ACK; đưa message về queue để xử lý lại
      channel.nack(message, false, true);
    }
  }

  @EventPattern('payment.failed')
  async handlePaymentFailed(
    @Payload()
    event: {
      paymentId: string;
      orderId: string;
      customerId: string;
      amount: string;
      failureReason?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const message = context.getMessage();

    try {
      this.logger.warn(`Received payment.failed: ${event.orderId}`);

      await this.ordersService.handlePaymentFailed(event);

      // ACK sau khi xử lý thành công
      channel.ack(message);

      this.logger.log(`ACK payment.failed: ${event.orderId}`);
    } catch (error) {
      this.logger.error(
        `Failed payment.failed: ${event.orderId}`,
        error instanceof Error ? error.stack : String(error),
      );

      channel.nack(message, false, true);
    }
  }
}
