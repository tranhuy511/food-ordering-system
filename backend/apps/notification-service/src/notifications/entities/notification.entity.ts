
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('notifications')
@Index(
  'UQ_notifications_order_event',
  ['orderId', 'eventType'],
  { unique: true },
)
@Index(
  'IDX_notifications_customer_created',
  ['customerId', 'createdAt'],
)
export class Notification {
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
    length: 60,
  })
  eventType: string;

  @Column({
    type: 'varchar',
    length: 150,
  })
  title: string;

  @Column({
    type: 'text',
  })
  message: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  data: Record<string, unknown> | null;

  @Column({
    type: 'boolean',
    default: false,
  })
  isRead: boolean;

  @CreateDateColumn({
    type: 'datetime',
  })
  createdAt: Date;
}
