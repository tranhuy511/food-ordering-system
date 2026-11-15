
import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';

import { ClientProxy } from '@nestjs/microservices';
import { DataSource } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { randomUUID } from 'node:crypto';

import { PaymentOutboxEvent } from './payment-outbox-event.entity';

@Injectable()
export class PaymentOutboxPublisherService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    PaymentOutboxPublisherService.name,
  );

  private readonly instanceId =
    `${process.env.COMPUTERNAME || 'payment-service'}-${process.pid}-${randomUUID()}`;

  private readonly batchSize = 10;
  private readonly maxRetries = 8;
  private readonly leaseTimeoutMs = 5 * 60 * 1000;
  private readonly publishTimeoutMs = 10000;
  private readonly pollingIntervalMs = 1000;

  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly dataSource: DataSource,

    @Inject('PAYMENT_EVENTS')
    private readonly paymentEvents: ClientProxy,
  ) {}

  // ==========================================
  // 1. START PUBLISHER
  // ==========================================

  onModuleInit(): void {
    this.logger.log(
      `Payment outbox publisher started: ${this.instanceId}`,
    );

    void this.publishBatch();

    this.timer = setInterval(() => {
      void this.publishBatch();
    }, this.pollingIntervalMs);
  }

  // ==========================================
  // 2. STOP PUBLISHER
  // ==========================================

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.logger.log(
      `Payment outbox publisher stopped: ${this.instanceId}`,
    );
  }

  // ==========================================
  // 3. PROCESS OUTBOX BATCH
  // ==========================================

  private async publishBatch(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const events = await this.claimBatch();

      if (events.length === 0) {
        return;
      }

      this.logger.debug(
        `Claimed ${events.length} payment outbox events`,
      );

      for (const event of events) {
        await this.publishOne(event);
      }
    } catch (error) {
      this.logger.error(
        'Payment outbox batch processing failed',
        error instanceof Error
          ? error.stack
          : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }

  // ==========================================
  // 4. CLAIM OUTBOX EVENTS
  // ==========================================

  private async claimBatch(): Promise<PaymentOutboxEvent[]> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(
        PaymentOutboxEvent,
      );

      // Giải phóng các sự kiện đã hết lease.
      const leaseTimeoutSeconds = Math.floor(
        this.leaseTimeoutMs / 1000,
      );

      await repository
        .createQueryBuilder()
        .update(PaymentOutboxEvent)
        .set({
          status: 'pending',
          lockedAt: null,
          lockedBy: null,
        })
        .where('status = :status', {
          status: 'processing',
        })
        .andWhere('lockedAt IS NOT NULL')
        .andWhere(
          `lockedAt < DATE_SUB(
            CURRENT_TIMESTAMP(6),
            INTERVAL ${leaseTimeoutSeconds} SECOND
          )`,
        )
        .execute();

      // Lấy các sự kiện đến hạn.
      const events = await repository
        .createQueryBuilder('event')
        .where('event.status = :status', {
          status: 'pending',
        })
        .andWhere(
          'event.nextAttemptAt <= CURRENT_TIMESTAMP(6)',
        )
        .orderBy('event.createdAt', 'ASC')
        .take(this.batchSize)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      // Claim sự kiện bằng thời gian của MySQL.
      if (events.length > 0) {
        await repository
          .createQueryBuilder()
          .update(PaymentOutboxEvent)
          .set({
            status: 'processing',
            lockedAt: () => 'CURRENT_TIMESTAMP(6)',
            lockedBy: this.instanceId,
          })
          .whereInIds(
            events.map((event) => event.id),
          )
          .execute();
      }

      return events;
    });
  }

  // ==========================================
  // 5. PUBLISH EVENT
  // ==========================================

  private async publishOne(
    event: PaymentOutboxEvent,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.paymentEvents
          .emit(event.eventType, event.payload)
          .pipe(timeout(this.publishTimeoutMs)),
      );

      const result = await this.dataSource
        .getRepository(PaymentOutboxEvent)
        .update(
          {
            id: event.id,
            status: 'processing',
            lockedBy: this.instanceId,
          },
          {
            status: 'published',
            publishedAt: () => 'CURRENT_TIMESTAMP(6)',
            lockedAt: null,
            lockedBy: null,
            lastError: null,
          },
        );

      if (result.affected === 1) {
        this.logger.log(
          `Published ${event.eventType}: ${event.aggregateId}`,
        );
      } else {
        this.logger.warn(
          `Cannot mark payment event as published: ${event.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to publish ${event.eventType}: ${event.aggregateId}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      await this.handlePublishFailure(event, error);
    }
  }

  // ==========================================
  // 6. RETRY FAILED EVENT
  // ==========================================

  private async handlePublishFailure(
    event: PaymentOutboxEvent,
    error: unknown,
  ): Promise<void> {
    const retryCount = event.retryCount + 1;
    const isDead = retryCount >= this.maxRetries;

    // Exponential backoff.
    // 1s -> 2s -> 4s -> 8s -> 16s -> 32s -> 60s.
    const delayMs = Math.min(
      60000,
      1000 * Math.pow(
        2,
        Math.min(retryCount - 1, 6),
      ),
    );

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    const result = await this.dataSource
      .getRepository(PaymentOutboxEvent)
      .update(
        {
          id: event.id,
          status: 'processing',
          lockedBy: this.instanceId,
        },
        {
          status: isDead ? 'dead' : 'pending',
          retryCount,
          nextAttemptAt: () =>
            `DATE_ADD(
              CURRENT_TIMESTAMP(6),
              INTERVAL ${delayMs} MICROSECOND
            )`,
          lockedAt: null,
          lockedBy: null,
          lastError: message,
        },
      );

    if (result.affected !== 1) {
      this.logger.warn(
        `Cannot update failed payment event: ${event.id}`,
      );

      return;
    }

    if (isDead) {
      this.logger.error(
        `Payment event moved to dead: ${event.eventType}, ${event.id}`,
      );
    } else {
      this.logger.warn(
        `Payment retry scheduled ${retryCount}/${this.maxRetries}: ` +
        `${event.eventType}, next attempt in ${delayMs}ms`,
      );
    }
  }
}
