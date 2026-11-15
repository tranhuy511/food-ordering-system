
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type OutboxEventStatus =
  | 'pending'
  | 'processing'
  | 'published'
  | 'dead';

@Entity('outbox_events')
@Index('IDX_outbox_pending_schedule', [
  'status',
  'nextAttemptAt',
  'createdAt',
])
@Index('IDX_outbox_processing_lease', ['status', 'lockedAt'])
@Index('IDX_outbox_aggregate', ['aggregateId'])
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  eventType: string;

  @Column({ type: 'varchar', length: 36 })
  aggregateId: string;

  @Column({ type: 'json' })
  payload: Record<string, unknown>;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: OutboxEventStatus;

  @Column({
    type: 'int',
    unsigned: true,
    default: 0,
  })
  retryCount: number;

  @Column({
    type: 'datetime',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  nextAttemptAt: Date;

  @Column({
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  lockedAt: Date | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  lockedBy: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  lastError: string | null;

  @CreateDateColumn({
    type: 'datetime',
    precision: 6,
  })
  createdAt: Date;

  @Column({
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  publishedAt: Date | null;
}
