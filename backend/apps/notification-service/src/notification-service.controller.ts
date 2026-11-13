import {
  Controller,
  Logger,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';

import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';

import { Request } from 'express';

import { JwtAuthGuard } from './auth/jwt-auth.guard';

import {
  NotificationServiceService,
  OrderCreatedEvent,
} from './notification-service.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller('notifications')
export class NotificationServiceController {
  private readonly logger = new Logger(NotificationServiceController.name);

  constructor(
    private readonly notificationService: NotificationServiceService,
  ) {}

  // API: Lấy danh sách thông báo của người dùng
  @Get()
  @UseGuards(JwtAuthGuard)
  async getNotifications(@Req() request: AuthenticatedRequest) {
    return this.notificationService.findAllByCustomer(request.user.id);
  }

  // API: Đánh dấu một thông báo đã đọc
  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notificationService.markAsRead(id, request.user.id);
  }

  // RabbitMQ: Nhận sự kiện tạo đơn hàng
  @EventPattern('order.created')
  async handleOrderCreated(
    @Payload() event: OrderCreatedEvent,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef();
    const message = context.getMessage();

    try {
      await this.notificationService.saveOrderCreated(event);

      this.logger.log(`Đã xử lý event order.created: ${event.orderId}`);

      channel.ack(message);
    } catch (error) {
      this.logger.error(
        `Không thể xử lý order.created: ${event?.orderId}`,
        error instanceof Error ? error.stack : String(error),
      );

      channel.nack(message, false, true);
    }
  }
}
