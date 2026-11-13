
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';

import { PaymentServiceService } from './payment-service.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { CreatePaymentDto } from './payments/dto/create-payment.dto';

interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    role: string;
  };
  headers: {
    authorization?: string;
  };
}

@Controller('payments')
export class PaymentServiceController {
  constructor(
    private readonly paymentServiceService: PaymentServiceService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createPayment(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePaymentDto,
  ) {
    const token = req.headers.authorization?.replace(
      /^Bearer\s+/i,
      '',
    );

    if (!token) {
      throw new Error('Missing authentication token');
    }

    return this.paymentServiceService.createPayment(
      req.user.id,
      token,
      dto.orderId,
    );
  }
}
