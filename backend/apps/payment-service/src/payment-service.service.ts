
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
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';

import {
  Payment,
  PaymentStatus,
  PaymentMethod,
} from './payments/entities/payment.entity';

@Injectable()
export class PaymentServiceService {
  private readonly logger = new Logger(PaymentServiceService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,

    @Inject('PAYMENT_EVENTS')
    private readonly paymentEvents: ClientProxy,
  ) {}

  async createPayment(
    customerId: string,
    token: string,
    orderId: string,
  ) {
    const orderServiceUrl =
      process.env.ORDER_SERVICE_URL || 'http://localhost:3002';

    // 1. Lấy thông tin đơn hàng từ Order Service.
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
      this.logger.error('Cannot connect to Order Service', error);
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
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        'Order Service trả về lỗi',
      );
    }

    const order = await response.json() as {
      id: string;
      customerId: string;
      paymentMethod: string;
      paymentStatus: string;
      status: string;
      totalAmount: string;
    };

    // 2. Kiểm tra quyền sở hữu.
    if (order.customerId !== customerId) {
      throw new UnauthorizedException(
        'Bạn không sở hữu đơn hàng này',
      );
    }

    // 3. Chỉ hỗ trợ thanh toán online.
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

    if (order.paymentStatus !== 'pending') {
      throw new ConflictException(
        'Đơn hàng không ở trạng thái chờ thanh toán',
      );
    }

    // 4. Không cho phép thanh toán trùng khi giao dịch
    // đang xử lý hoặc đã thành công.
    const existingPayment = await this.paymentRepository.findOne({
      where: [
        {
          orderId,
          status: PaymentStatus.PENDING,
        },
        {
          orderId,
          status: PaymentStatus.SUCCESS,
        },
      ],
    });

    if (existingPayment) {
      throw new ConflictException(
        'Đơn hàng đã có giao dịch đang xử lý hoặc đã thanh toán thành công',
      );
    }

    // 5. Lấy số tiền từ Order Service.
    const amount = Number(order.totalAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        'Số tiền đơn hàng không hợp lệ',
      );
    }

    const amountString = amount.toFixed(2);

    // 6. Mô phỏng kết quả thanh toán.
    // Mặc định thành công; có thể cấu hình thất bại để kiểm thử.
    const mockResult =
      process.env.MOCK_PAYMENT_RESULT || 'success';

    const isSuccess = mockResult === 'success';

    const transactionId =
      `MOCK-${Date.now()}`;

    const payment = this.paymentRepository.create({
      orderId,
      customerId,
      amount: amountString,
      paymentMethod: PaymentMethod.ONLINE,
      status: isSuccess
        ? PaymentStatus.SUCCESS
        : PaymentStatus.FAILED,
      transactionId: isSuccess ? transactionId : null,
      failureReason: isSuccess
        ? null
        : 'Mock payment failed',
    });

    const savedPayment =
      await this.paymentRepository.save(payment);

    // 7. Phát sự kiện cho Order Service.
    const eventName = isSuccess
      ? 'payment.completed'
      : 'payment.failed';

    const eventPayload = isSuccess
      ? {
          paymentId: savedPayment.id,
          orderId,
          customerId,
          amount: amountString,
          transactionId,
        }
      : {
          paymentId: savedPayment.id,
          orderId,
          customerId,
          amount: amountString,
          failureReason: savedPayment.failureReason,
        };

    try {
      await firstValueFrom(
        this.paymentEvents.emit(eventName, eventPayload),
      );
    } catch (error) {
      this.logger.error(
        `Cannot publish ${eventName}`,
        error,
      );

      // Giao dịch đã được lưu, không tạo giao dịch khác.
      // Cần bổ sung cơ chế outbox/retry để xử lý lỗi này.
      throw new InternalServerErrorException(
        'Đã lưu giao dịch nhưng chưa gửi được sự kiện thanh toán',
      );
    }

    return {
      message: isSuccess
        ? 'Thanh toán thành công'
        : 'Thanh toán thất bại',
      payment: savedPayment,
    };
  }
}
