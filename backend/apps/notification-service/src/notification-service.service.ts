import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification } from './notifications/entities/notification.entity';

export interface OrderCreatedEvent {
  eventVersion: number;
  orderId: string;
  customerId: string;
  restaurantId: string;
  totalAmount: string;
  paymentMethod: string;
  createdAt: string | Date;

  items: {
    productId: string;
    productName: string;
    unitPrice: string;
    quantity: number;
    subtotal: string;
  }[];
}

@Injectable()
export class NotificationServiceService {
  private readonly logger = new Logger(NotificationServiceService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async saveOrderCreated(event: OrderCreatedEvent): Promise<void> {
    // Kiểm tra dữ liệu sự kiện.
    if (
      !event ||
      !event.orderId ||
      !event.customerId ||
      !Array.isArray(event.items)
    ) {
      throw new BadRequestException(
        'Dữ liệu sự kiện order.created không hợp lệ',
      );
    }

    const productNames = event.items
      .map((item) => `${item.productName} x ${item.quantity}`)
      .join(', ');

    const notification = this.notificationRepository.create({
      orderId: event.orderId,
      customerId: event.customerId,
      eventType: 'order.created',

      title: 'Đặt hàng thành công',

      message:
        `Đơn hàng ${event.orderId} đã được tạo thành công. ` +
        `Sản phẩm: ${productNames}. ` +
        `Tổng tiền: ${event.totalAmount}.`,

      data: event as unknown as Record<string, unknown>,

      isRead: false,
    });

    // INSERT IGNORE: không tạo thông báo trùng
    // khi RabbitMQ gửi lại cùng một sự kiện.
    const result = await this.notificationRepository
      .createQueryBuilder()
      .insert()
      .into(Notification)
      .values(notification)
      .orIgnore()
      .execute();

    if (result.identifiers.length > 0) {
      this.logger.log(`Đã lưu thông báo cho đơn hàng ${event.orderId}`);
    } else {
      this.logger.warn(`Thông báo cho đơn hàng ${event.orderId} đã tồn tại`);
    }
  }

  async findAllByCustomer(customerId: string) {
    return this.notificationRepository.find({
      where: { customerId },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async markAsRead(notificationId: string, customerId: string) {
    const result = await this.notificationRepository.update(
      {
        id: notificationId,
        customerId,
      },
      {
        isRead: true,
      },
    );

    if (result.affected === 0) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return {
      message: 'Đã đánh dấu thông báo là đã đọc',
    };
  }
}
