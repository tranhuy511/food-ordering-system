import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { DataSource, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';

import {
  Payment,
  PaymentStatus,
  PaymentMethod,
} from './payments/entities/payment.entity';

import { PaymentOrder } from './payments/entities/payment-order.entity';

@Injectable()
export class PaymentServiceService {
  private readonly logger = new Logger(PaymentServiceService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,

    @InjectRepository(PaymentOrder)
    private readonly paymentOrderRepository: Repository<PaymentOrder>,

    private readonly dataSource: DataSource,

    @Inject('PAYMENT_EVENTS')
    private readonly paymentEvents: ClientProxy,
  ) {}

  async createPayment(customerId: string, token: string, orderId: string) {
    const orderServiceUrl =
      process.env.ORDER_SERVICE_URL || 'http://localhost:3002';

    // 1. Lấy thông tin đơn hàng từ Order Service.
    let response: Response;

    try {
      response = await fetch(`${orderServiceUrl}/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      this.logger.error('Cannot connect to Order Service', error);

      throw new InternalServerErrorException('Không thể kết nối Order Service');
    }

    if (response.status === 401 || response.status === 403) {
      throw new UnauthorizedException('Không có quyền truy cập đơn hàng');
    }

    if (response.status === 404) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    if (!response.ok) {
      throw new InternalServerErrorException('Order Service trả về lỗi');
    }

    const order = (await response.json()) as {
      id: string;
      customerId: string;
      paymentMethod: string;
      paymentStatus: string;
      status: string;
      totalAmount: string;
    };

    // 2. Kiểm tra quyền sở hữu đơn hàng.
    if (order.customerId !== customerId) {
      throw new UnauthorizedException('Bạn không sở hữu đơn hàng này');
    }

    // 3. Kiểm tra điều kiện thanh toán.
    if (order.paymentMethod !== PaymentMethod.ONLINE) {
      throw new BadRequestException('Đơn hàng không sử dụng thanh toán online');
    }

    if (order.status === 'cancelled') {
      throw new BadRequestException('Không thể thanh toán đơn hàng đã hủy');
    }

    // Cho phép thanh toán mới nếu lần trước thất bại.
    if (order.paymentStatus !== 'pending' && order.paymentStatus !== 'failed') {
      throw new ConflictException(
        'Đơn hàng không ở trạng thái chờ thanh toán hoặc có thể thử lại',
      );
    }

    // 4. Kiểm tra số tiền.
    const amount = Number(order.totalAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Số tiền đơn hàng không hợp lệ');
    }

    const amountString = amount.toFixed(2);

    // 5. Mô phỏng kết quả thanh toán.
    const mockResult = process.env.MOCK_PAYMENT_RESULT || 'success';

    const isSuccess = mockResult === 'success';

    const transactionId = `MOCK-${Date.now()}`;

    // 6. Tạo Payment và cập nhật PaymentOrder
    // trong cùng một Database transaction.
    const savedPayment = await this.dataSource.transaction(async (manager) => {
      // Khởi tạo bản ghi quản lý nếu chưa tồn tại.
      // UNIQUE(orderId) tránh tạo nhiều bản ghi cho cùng đơn hàng.
      await manager.query(
        `
            INSERT INTO payment_orders (
              id,
              orderId,
              customerId,
              activePaymentId,
              status,
              createdAt,
              updatedAt
            )
            VALUES (
              UUID(),
              ?,
              ?,
              NULL,
              'pending',
              NOW(6),
              NOW(6)
            )
            ON DUPLICATE KEY UPDATE
              orderId = VALUES(orderId)
          `,
        [orderId, customerId],
      );

      const paymentOrderRepo = manager.getRepository(PaymentOrder);

      const paymentRepo = manager.getRepository(Payment);

      // Khóa bản ghi để tuần tự hóa các yêu cầu thanh toán.
      const paymentOrder = await paymentOrderRepo.findOne({
        where: { orderId },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!paymentOrder) {
        throw new InternalServerErrorException(
          'Không thể khởi tạo trạng thái thanh toán',
        );
      }

      // Kiểm tra quyền sở hữu bản ghi thanh toán.
      if (paymentOrder.customerId !== customerId) {
        throw new UnauthorizedException('Bạn không sở hữu đơn hàng này');
      }

      // Không cho thanh toán lại nếu đã thành công.
      if (paymentOrder.status === PaymentStatus.SUCCESS) {
        throw new ConflictException('Đơn hàng đã được thanh toán thành công');
      }

      // Không cho tạo giao dịch mới khi đang có giao dịch pending.
      if (
        paymentOrder.status === PaymentStatus.PENDING &&
        paymentOrder.activePaymentId !== null
      ) {
        throw new ConflictException(
          'Đơn hàng đang có giao dịch thanh toán được xử lý',
        );
      }

      // Không cho thanh toán lại đơn hàng đã hoàn tiền.
      if (paymentOrder.status === PaymentStatus.REFUNDED) {
        throw new ConflictException(
          'Đơn hàng đã được hoàn tiền, không thể thanh toán lại',
        );
      }

      // FAILED được phép thử thanh toán lại.
      // Tăng số lần thanh toán trong bản ghi PaymentOrder.
      const nextAttemptNumber = paymentOrder.attemptNumber + 1;

      if (!Number.isSafeInteger(nextAttemptNumber) || nextAttemptNumber <= 0) {
        throw new InternalServerErrorException(
          'Số lần thanh toán không hợp lệ',
        );
      }

      // Tạo giao dịch thanh toán mới.
      const payment = paymentRepo.create({
        orderId,
        customerId,
        amount: amountString,
        paymentMethod: PaymentMethod.ONLINE,
        status: isSuccess ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
        attemptNumber: nextAttemptNumber,
        transactionId: isSuccess ? transactionId : null,
        failureReason: isSuccess ? null : 'Mock payment failed',
      });

      const saved = await paymentRepo.save(payment);

      // Cập nhật trạng thái và số lần thanh toán hiện tại.
      paymentOrder.activePaymentId = saved.id;
      paymentOrder.status = saved.status;
      paymentOrder.attemptNumber = nextAttemptNumber;

      await paymentOrderRepo.save(paymentOrder);

      return saved;
    });

    // 7. Phát sự kiện RabbitMQ sau khi Database transaction commit.
    const eventName = isSuccess ? 'payment.completed' : 'payment.failed';

    // Gửi attemptNumber để Order Service xác định
    // sự kiện thuộc lần thanh toán nào.
    const eventPayload = isSuccess
      ? {
          paymentId: savedPayment.id,
          orderId,
          customerId,
          amount: amountString,
          attemptNumber: savedPayment.attemptNumber,
          transactionId,
        }
      : {
          paymentId: savedPayment.id,
          orderId,
          customerId,
          amount: amountString,
          attemptNumber: savedPayment.attemptNumber,
          failureReason: savedPayment.failureReason,
        };

    try {
      await firstValueFrom(this.paymentEvents.emit(eventName, eventPayload));
    } catch (error) {
      this.logger.error(`Cannot publish ${eventName}`, error);

      // Giao dịch đã được lưu trong Database.
      // Cần Transactional Outbox để bảo đảm gửi lại sự kiện.
      throw new InternalServerErrorException(
        'Đã lưu giao dịch nhưng chưa gửi được sự kiện thanh toán',
      );
    }

    // 8. Trả kết quả cho client.
    return {
      message: isSuccess ? 'Thanh toán thành công' : 'Thanh toán thất bại',
      payment: savedPayment,
    };
  }
}
