
import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { ClientProxy } from '@nestjs/microservices';
import { DataSource } from 'typeorm';

import {
  Order,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
} from './entities/order.entity';

import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly dataSource: DataSource,

    @Inject('ORDER_EVENTS')
    private readonly orderEvents: ClientProxy,
  ) {}

  // ==========================================
  // 1. CREATE ORDER
  // POST /orders
  // ==========================================

  async create(
    customerId: string,
    dto: CreateOrderDto,
  ): Promise<Order> {
    if (!customerId) {
      throw new BadRequestException(
        'Không xác định được khách hàng',
      );
    }

    // Tính tiền bằng cent để hạn chế sai số.
    const items = dto.items.map((item) => {
      const unitPriceCents = Math.round(
        item.unitPrice * 100,
      );

      const subtotalCents =
        unitPriceCents * item.quantity;

      return {
        productId: item.productId,
        productName: item.productName,
        unitPrice: (unitPriceCents / 100).toFixed(2),
        quantity: item.quantity,
        subtotal: (subtotalCents / 100).toFixed(2),
        subtotalCents,
      };
    });

    const totalCents = items.reduce(
      (sum, item) => sum + item.subtotalCents,
      0,
    );

    if (
      !Number.isSafeInteger(totalCents) ||
      totalCents > 999999999999
    ) {
      throw new BadRequestException(
        'Tổng tiền đơn hàng không hợp lệ',
      );
    }

    // Lưu đơn hàng và chi tiết trong cùng transaction.
    const createdOrder = await this.dataSource.transaction(
      async (manager) => {
        const orderRepository =
          manager.getRepository(Order);

        const itemRepository =
          manager.getRepository(OrderItem);

        const order = orderRepository.create({
          customerId,
          restaurantId: dto.restaurantId,
          deliveryAddress: dto.deliveryAddress,
          note: dto.note ?? null,
          paymentMethod: dto.paymentMethod,
          totalAmount: (totalCents / 100).toFixed(2),
        });

        const savedOrder =
          await orderRepository.save(order);

        const orderItems = items.map((item) =>
          itemRepository.create({
            productId: item.productId,
            productName: item.productName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            subtotal: item.subtotal,
            order: savedOrder,
          }),
        );

        await itemRepository.save(orderItems);

        const result = await orderRepository.findOne({
          where: {
            id: savedOrder.id,
          },
          relations: {
            items: true,
          },
        });

        if (!result) {
          throw new InternalServerErrorException(
            'Không thể lấy thông tin đơn hàng vừa tạo',
          );
        }

        return result;
      },
    );

    // Transaction đã commit thành công.
    // Phát sự kiện order.created qua RabbitMQ.
    this.orderEvents.emit('order.created', {
      eventVersion: 1,
      orderId: createdOrder.id,
      customerId: createdOrder.customerId,
      restaurantId: createdOrder.restaurantId,
      totalAmount: createdOrder.totalAmount,
      paymentMethod: createdOrder.paymentMethod,
      createdAt: createdOrder.createdAt,

      items: createdOrder.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
    }).subscribe({
      error: (error) => {
        this.logger.error(
          'Không thể gửi event order.created',
          error instanceof Error
            ? error.stack
            : String(error),
        );
      },
    });

    return createdOrder;
  }

  // ==========================================
  // 2. GET ALL ORDERS
  // GET /orders
  // ==========================================

  async findAll(
    customerId: string,
  ): Promise<Order[]> {
    const orderRepository =
      this.dataSource.getRepository(Order);

    return orderRepository.find({
      where: {
        customerId,
      },
      relations: {
        items: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  // ==========================================
  // 3. GET ORDER DETAIL
  // GET /orders/:id
  // ==========================================

  async findOne(
    id: string,
    customerId: string,
  ): Promise<Order> {
    const orderRepository =
      this.dataSource.getRepository(Order);

    const order = await orderRepository.findOne({
      where: {
        id,
        customerId,
      },
      relations: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException(
        'Không tìm thấy đơn hàng',
      );
    }

    return order;
  }

  // ==========================================
  // 4. CANCEL ORDER
  // PATCH /orders/:id/cancel
  // ==========================================

  async cancel(
    id: string,
    customerId: string,
  ): Promise<Order> {
    return this.dataSource.transaction(
      async (manager) => {
        const orderRepository =
          manager.getRepository(Order);

        // Khóa bản ghi để tránh hai yêu cầu
        // cùng hủy một đơn hàng đồng thời.
        const order = await orderRepository.findOne({
          where: {
            id,
            customerId,
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (!order) {
          throw new NotFoundException(
            'Không tìm thấy đơn hàng',
          );
        }

        if (order.status !== OrderStatus.PENDING) {
          throw new BadRequestException(
            'Chỉ đơn hàng đang chờ xác nhận mới được hủy',
          );
        }

        order.status = OrderStatus.CANCELLED;

        await orderRepository.save(order);

        const result = await orderRepository.findOne({
          where: {
            id,
            customerId,
          },
          relations: {
            items: true,
          },
        });

        if (!result) {
          throw new NotFoundException(
            'Không tìm thấy đơn hàng sau khi cập nhật',
          );
        }

        return result;
      },
    );
  }

  // ==========================================
  // 5. UPDATE ORDER STATUS
  // PATCH /orders/:id/status
  // ==========================================

  async updateStatus(
    id: string,
    newStatus: OrderStatus,
  ): Promise<Order> {
    return this.dataSource.transaction(
      async (manager) => {
        const orderRepository =
          manager.getRepository(Order);

        const order = await orderRepository.findOne({
          where: {
            id,
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (!order) {
          throw new NotFoundException(
            'Không tìm thấy đơn hàng',
          );
        }

        // Quy định các trạng thái được chuyển tiếp.
        const allowedTransitions: Record<
          OrderStatus,
          OrderStatus[]
        > = {
          [OrderStatus.PENDING]: [
            OrderStatus.CONFIRMED,
          ],

          [OrderStatus.CONFIRMED]: [
            OrderStatus.PREPARING,
          ],

          [OrderStatus.PREPARING]: [
            OrderStatus.READY,
          ],

          [OrderStatus.READY]: [
            OrderStatus.DELIVERING,
          ],

          [OrderStatus.DELIVERING]: [
            OrderStatus.COMPLETED,
          ],

          [OrderStatus.COMPLETED]: [],

          [OrderStatus.CANCELLED]: [],
        };

        if (
          !allowedTransitions[order.status].includes(
            newStatus,
          )
        ) {
          throw new BadRequestException(
            `Không thể chuyển từ ${order.status} sang ${newStatus}`,
          );
        }

        order.status = newStatus;

        await orderRepository.save(order);

        const result = await orderRepository.findOne({
          where: {
            id,
          },
          relations: {
            items: true,
          },
        });

        if (!result) {
          throw new NotFoundException(
            'Không tìm thấy đơn hàng sau khi cập nhật',
          );
        }

        return result;
      },
    );
  }

  // ==========================================
  // 5. HANDLE PAYMENT COMPLETED
  // RabbitMQ: payment.completed
  // ==========================================

  async handlePaymentCompleted(event: {
    paymentId: string;
    orderId: string;
    customerId: string;
    amount: string;
    transactionId?: string;
  }): Promise<void> {
    await this.dataSource.transaction(
      async (manager) => {
        const orderRepository =
          manager.getRepository(Order);

        const order = await orderRepository.findOne({
          where: {
            id: event.orderId,
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (!order) {
          this.logger.error(
            `Payment event references missing order: ${event.orderId}`,
          );
          return;
        }

        // Kiểm tra chủ sở hữu đơn hàng.
        if (order.customerId !== event.customerId) {
          this.logger.error(
            `Payment customer mismatch: ${event.orderId}`,
          );
          return;
        }

        // Chỉ đơn hàng thanh toán online mới xử lý sự kiện này.
        if (order.paymentMethod !== PaymentMethod.ONLINE) {
          this.logger.error(
            `Order is not an online payment: ${event.orderId}`,
          );
          return;
        }

        // Không thanh toán cho đơn hàng đã hủy.
        if (order.status === OrderStatus.CANCELLED) {
          this.logger.warn(
            `Ignoring payment for cancelled order: ${event.orderId}`,
          );
          return;
        }

        // Không ghi đè trạng thái đã thanh toán hoặc hoàn tiền.
        if (
          order.paymentStatus === PaymentStatus.PAID ||
          order.paymentStatus === PaymentStatus.REFUNDED
        ) {
          this.logger.warn(
            `Payment already processed: ${event.orderId}`,
          );
          return;
        }

        // Kiểm tra số tiền từ Payment Service.
        const orderAmountCents = Math.round(
          Number(order.totalAmount) * 100,
        );

        const eventAmountCents = Math.round(
          Number(event.amount) * 100,
        );

        if (
          !Number.isSafeInteger(eventAmountCents) ||
          eventAmountCents <= 0 ||
          orderAmountCents !== eventAmountCents
        ) {
          this.logger.error(
            `Payment amount mismatch: ${event.orderId}`,
          );
          return;
        }

        order.paymentStatus = PaymentStatus.PAID;

        await orderRepository.save(order);

        this.logger.log(
          `Payment completed for order: ${event.orderId}`,
        );
      },
    );
  }

  // ==========================================
  // 6. HANDLE PAYMENT FAILED
  // RabbitMQ: payment.failed
  // ==========================================

  async handlePaymentFailed(event: {
    paymentId: string;
    orderId: string;
    customerId: string;
    amount: string;
    failureReason?: string;
  }): Promise<void> {
    await this.dataSource.transaction(
      async (manager) => {
        const orderRepository =
          manager.getRepository(Order);

        const order = await orderRepository.findOne({
          where: {
            id: event.orderId,
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (!order) {
          this.logger.error(
            `Payment event references missing order: ${event.orderId}`,
          );
          return;
        }

        if (order.customerId !== event.customerId) {
          this.logger.error(
            `Payment customer mismatch: ${event.orderId}`,
          );
          return;
        }

        if (order.paymentMethod !== PaymentMethod.ONLINE) {
          this.logger.error(
            `Order is not an online payment: ${event.orderId}`,
          );
          return;
        }

        // Không ghi đè trạng thái đã thanh toán hoặc hoàn tiền.
        if (
          order.paymentStatus === PaymentStatus.PAID ||
          order.paymentStatus === PaymentStatus.REFUNDED
        ) {
          this.logger.warn(
            `Ignoring failed event for processed order: ${event.orderId}`,
          );
          return;
        }

        if (order.paymentStatus === PaymentStatus.FAILED) {
          this.logger.warn(
            `Payment failure already processed: ${event.orderId}`,
          );
          return;
        }

        if (order.status === OrderStatus.CANCELLED) {
          this.logger.warn(
            `Ignoring payment failure for cancelled order: ${event.orderId}`,
          );
          return;
        }

        const orderAmountCents = Math.round(
          Number(order.totalAmount) * 100,
        );

        const eventAmountCents = Math.round(
          Number(event.amount) * 100,
        );

        if (
          !Number.isSafeInteger(eventAmountCents) ||
          eventAmountCents <= 0 ||
          orderAmountCents !== eventAmountCents
        ) {
          this.logger.error(
            `Payment amount mismatch: ${event.orderId}`,
          );
          return;
        }

        order.paymentStatus = PaymentStatus.FAILED;

        await orderRepository.save(order);

        this.logger.warn(
          `Payment failed for order: ${event.orderId}`,
        );
      },
    );
  }

}
