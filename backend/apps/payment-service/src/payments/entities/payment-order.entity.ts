import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { PaymentStatus } from './payment.entity';

@Entity('payment_orders')
@Index('UQ_payment_orders_orderId', ['orderId'], {
  unique: true,
})
@Index('IDX_payment_orders_customerId', ['customerId'])
export class PaymentOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 36,
  })
  orderId: string;

  @Column({
    type: 'varchar',
    length: 36,
  })
  customerId: string;

  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  activePaymentId: string | null;

  @Column({
    type: 'varchar',
    length: 30,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
