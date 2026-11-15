
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { DataSource } from 'typeorm';

import {
  Payment,
  PaymentStatus,
  PaymentMethod,
} from './payments/entities/payment.entity';

import { PaymentOrder } from './payments/entities/payment-order.entity';

import { PaymentOutboxEvent } from './outbox/payment-outbox-event.entity';

@Injectable()
export class PaymentServiceService {
  private readonly logger = new Logger(PaymentServiceService.name);

  constructor(
    private readonly dataSource: DataSource,
  ) {}

  // ==========================================
  // 1. CREATE PAYMENT
  // POST /payments
  // ==========================================

  async createPayment(
    customerId: string,
    token: string,
    orderId: string,
  ) {
    const orderServiceUrl =
      process.env.ORDER_SERVICE_URL || 'http://localhost:3002';

    // ------------------------------------------
    // 1. LẤY THÔNG TIN ĐƠN HÀNG TỪ ORDER SERVICE
    // ------------------------------------------

    let response: Response;

    try {
      response = await fetch(
        `${orderServiceUrl}/orders/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
    } catch (error) {
      this.logger.error(
        'Cannot connect to Order Service',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        'Không thể kết nối Order Service',
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new UnauthorizedException(
        'Không có quyền truy cập đơn hàng',
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(
        'Không tìm thấy đơn hàng',
      );
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        'Order Service trả về lỗi',
      );
    }

    const order = (await response.json()) as {
      id: string;
      customerId: string;
      paymentMethod: string;
      paymentStatus: string;
      status: string;
      totalAmount: string;
    };

    // ------------------------------------------
    // 2. KIỂM TRA QUYỀN SỞ HỮU ĐƠN HÀNG
    // ------------------------------------------

    if (order.customerId !== customerId) {
      throw new UnauthorizedException(
        'Bạn không sở hữu đơn hàng này',
      );
    }

    // ------------------------------------------
    // 3. KIỂM TRA ĐIỀU KIỆN THANH TOÁN
    // ------------------------------------------

    if (order.paymentMethod !== PaymentMethod.ONLINE) {
      throw new BadRequestException(
        'Đơn hàng không sử dụng thanh toán online',
      );
    }

    if (order.status === 'cancelled') {
      throw new BadRequestException(
        'Không thể thanh toán đơn hàng đã hủy',
      );
    }

    // Chỉ cho phép thanh toán mới nếu trạng thái
    // thanh toán hiện tại là pending hoặc failed.
    if (
      order.paymentStatus !== 'pending' &&
      order.paymentStatus !== 'failed'
    ) {
      throw new ConflictException(
        'Đơn hàng không ở trạng thái chờ thanh toán hoặc có thể thử lại',
      );
    }

    // ------------------------------------------
    // 4. KIỂM TRA SỐ TIỀN
    // ------------------------------------------

    const amount = Number(order.totalAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        'Số tiền đơn hàng không hợp lệ',
      );
    }

    const amountString = amount.toFixed(2);

    // ------------------------------------------
    // 5. MÔ PHỎNG KẾT QUẢ THANH TOÁN
    // ------------------------------------------

    const mockResult =
      process.env.MOCK_PAYMENT_RESULT || 'success';

    const isSuccess = mockResult === 'success';

    const transactionId = `MOCK-${Date.now()}`;

    // ------------------------------------------
    // 6. TRANSACTIONAL OUTBOX
    //
    // Lưu Payment, PaymentOrder và Outbox Event
    // trong cùng một Database transaction.
    // ------------------------------------------

    const savedPayment = await this.dataSource.transaction(
      async (manager) => {
        // --------------------------------------
        // 6.1. KHỞI TẠO PAYMENT ORDER
        // --------------------------------------

        // UNIQUE(orderId) tránh tạo nhiều bản ghi
        // quản lý thanh toán cho cùng một đơn hàng.

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

        const paymentOrderRepo =
          manager.getRepository(PaymentOrder);

        const paymentRepo =
          manager.getRepository(Payment);

        // --------------------------------------
        // 6.2. KHÓA PAYMENT ORDER
        // --------------------------------------

        // Tuần tự hóa các yêu cầu thanh toán
        // đồng thời trên cùng một orderId.

        const paymentOrder = await paymentOrderRepo.findOne({
          where: {
            orderId,
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (!paymentOrder) {
          throw new InternalServerErrorException(
            'Không thể khởi tạo trạng thái thanh toán',
          );
        }

        // --------------------------------------
        // 6.3. KIỂM TRA QUYỀN SỞ HỮU
        // --------------------------------------

        if (paymentOrder.customerId !== customerId) {
          throw new UnauthorizedException(
            'Bạn không sở hữu đơn hàng này',
          );
        }

        // --------------------------------------
        // 6.4. CHỐNG THANH TOÁN TRÙNG
        // --------------------------------------

        if (paymentOrder.status === PaymentStatus.SUCCESS) {
          throw new ConflictException(
            'Đơn hàng đã được thanh toán thành công',
          );
        }

        // Không tạo giao dịch mới khi đang
        // có một giao dịch pending được xử lý.

        if (
          paymentOrder.status === PaymentStatus.PENDING &&
          paymentOrder.activePaymentId !== null
        ) {
          throw new ConflictException(
            'Đơn hàng đang có giao dịch thanh toán được xử lý',
          );
        }

        // Không cho thanh toán lại đơn hàng
        // đã được hoàn tiền.

        if (paymentOrder.status === PaymentStatus.REFUNDED) {
          throw new ConflictException(
            'Đơn hàng đã được hoàn tiền, không thể thanh toán lại',
          );
        }

        // --------------------------------------
        // 6.5. TĂNG ATTEMPT NUMBER
        // --------------------------------------

        // Cho phép retry nếu lần trước thất bại.

        const nextAttemptNumber =
          paymentOrder.attemptNumber + 1;

        if (
          !Number.isSafeInteger(nextAttemptNumber) ||
          nextAttemptNumber <= 0
        ) {
          throw new InternalServerErrorException(
            'Số lần thanh toán không hợp lệ',
          );
        }

        // --------------------------------------
        // 6.6. TẠO PAYMENT
        // --------------------------------------

        const payment = paymentRepo.create({
          orderId,
          customerId,
          amount: amountString,
          paymentMethod: PaymentMethod.ONLINE,

          status: isSuccess
            ? PaymentStatus.SUCCESS
            : PaymentStatus.FAILED,

          attemptNumber: nextAttemptNumber,

          transactionId: isSuccess
            ? transactionId
            : null,

          failureReason: isSuccess
            ? null
            : 'Mock payment failed',
        });

        const saved = await paymentRepo.save(payment);

        // --------------------------------------
        // 6.7. CẬP NHẬT PAYMENT ORDER
        // --------------------------------------

        paymentOrder.activePaymentId = saved.id;
        paymentOrder.status = saved.status;
        paymentOrder.attemptNumber = nextAttemptNumber;

        await paymentOrderRepo.save(paymentOrder);

        // --------------------------------------
        // 6.8. TẠO PAYMENT EVENT
        // --------------------------------------

        const eventName = isSuccess
          ? 'payment.completed'
          : 'payment.failed';

        // Giữ nguyên cấu trúc payload mà
        // Order Service đang sử dụng.

        const eventPayload: Record<string, unknown> =
          isSuccess
            ? {
                paymentId: saved.id,
                orderId,
                customerId,
                amount: amountString,
                attemptNumber: saved.attemptNumber,
                transactionId,
              }
            : {
                paymentId: saved.id,
                orderId,
                customerId,
                amount: amountString,
                attemptNumber: saved.attemptNumber,
                failureReason: saved.failureReason,
              };

        // --------------------------------------
        // 6.9. GHI PAYMENT OUTBOX EVENT
        // --------------------------------------

        const outboxRepository =
          manager.getRepository(PaymentOutboxEvent);

        const outboxEvent = outboxRepository.create({
          eventType: eventName,
          aggregateId: orderId,
          payload: eventPayload,

          status: 'pending',
          retryCount: 0,

          // Để MySQL tự sử dụng:
          // CURRENT_TIMESTAMP(6).
          // Không dùng new Date() để tránh lệch múi giờ.

          lockedAt: null,
          lockedBy: null,
          lastError: null,
          publishedAt: null,
        });

        await outboxRepository.save(outboxEvent);

        this.logger.log(
          `Payment and outbox event saved: ${eventName}, ` +
          `order ${orderId}, attempt ${saved.attemptNumber}`,
        );

        // Trả giao dịch vừa lưu.
        // Database transaction sẽ commit sau callback này.
        return saved;
      },
    );

    // ------------------------------------------
    // 7. TRẢ KẾT QUẢ CHO CLIENT
    //
    // Không gửi RabbitMQ trực tiếp ở đây nữa.
    // PaymentOutboxPublisherService đảm nhiệm việc đó.
    // ------------------------------------------

    return {
      message: isSuccess
        ? 'Thanh toán thành công'
        : 'Thanh toán thất bại',

      payment: savedPayment,
    };
  }
}
