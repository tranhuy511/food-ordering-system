
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

import { OutboxEvent } from './outbox-event.entity';

@Injectable()
export class OutboxPublisherService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxPublisherService.name);

  // Định danh riêng cho mỗi instance.
  // Giúp phân biệt hai Order Service chạy ở cổng 3002 và 3012.
  private readonly instanceId =
    `${process.env.COMPUTERNAME || 'order-service'}-${process.pid}-${randomUUID()}`;

  // Số sự kiện lấy trong một lần xử lý.
  private readonly batchSize = 10;

  // Số lần thử gửi tối đa.
  private readonly maxRetries = 8;

  // Thời gian khóa sự kiện: 5 phút.
  private readonly leaseTimeoutMs = 5 * 60 * 1000;

  // Thời gian chờ gửi RabbitMQ tối đa: 10 giây.
  private readonly publishTimeoutMs = 10000;

  // Khoảng thời gian kiểm tra Outbox: 1 giây.
  private readonly pollingIntervalMs = 1000;

  private timer: NodeJS.Timeout | null = null;

  // Không cho hai batch chạy chồng nhau trong cùng instance.
  private isRunning = false;

  constructor(
    private readonly dataSource: DataSource,

    @Inject('ORDER_EVENTS')
    private readonly orderEvents: ClientProxy,
  ) {}

  // ==========================================
  // 1. START PUBLISHER
  // ==========================================

  onModuleInit(): void {
    this.logger.log(
      `Outbox publisher started: ${this.instanceId}`,
    );

    // Xử lý ngay khi Service khởi động.
    void this.publishBatch();

    // Kiểm tra Outbox định kỳ.
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
      `Outbox publisher stopped: ${this.instanceId}`,
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
      // Lấy và khóa một nhóm sự kiện.
      const events = await this.claimBatch();

      if (events.length === 0) {
        return;
      }

      this.logger.debug(
        `Claimed ${events.length} outbox events`,
      );

      // Gửi tuần tự từng sự kiện trong batch.
      for (const event of events) {
        await this.publishOne(event);
      }
    } catch (error) {
      this.logger.error(
        'Outbox batch processing failed',
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

  /**
   * Claim sự kiện bằng MySQL transaction và row-level lock.
   *
   * FOR UPDATE SKIP LOCKED giúp nhiều instance cùng chạy
   * nhưng không lấy cùng một bản ghi tại thời điểm claim.
   *
   * Tất cả thao tác thời gian sử dụng đồng hồ MySQL.
   */
  private async claimBatch(): Promise<OutboxEvent[]> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(OutboxEvent);

      // ------------------------------------------
      // 4.1. Giải phóng các bản ghi hết lease
      // ------------------------------------------

      const leaseTimeoutSeconds = Math.floor(
        this.leaseTimeoutMs / 1000,
      );

      await repository
        .createQueryBuilder()
        .update(OutboxEvent)
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

      // ------------------------------------------
      // 4.2. Lấy các sự kiện đang chờ xử lý
      // ------------------------------------------

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

      // ------------------------------------------
      // 4.3. Đánh dấu các sự kiện đang xử lý
      // ------------------------------------------

      if (events.length > 0) {
        await repository
          .createQueryBuilder()
          .update(OutboxEvent)
          .set({
            status: 'processing',

            // Sử dụng thời gian MySQL,
            // tránh lỗi lệch múi giờ giữa Node.js và MySQL.
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
  // 5. PUBLISH ONE EVENT
  // ==========================================

  private async publishOne(
    event: OutboxEvent,
  ): Promise<void> {
    try {
      // Phát sự kiện lên RabbitMQ.
      await firstValueFrom(
        this.orderEvents
          .emit(event.eventType, event.payload)
          .pipe(
            timeout(this.publishTimeoutMs),
          ),
      );

      // ------------------------------------------
      // Đánh dấu sự kiện đã gửi thành công.
      // Chỉ cập nhật nếu instance này vẫn sở hữu lock.
      // ------------------------------------------

      const result = await this.dataSource
        .getRepository(OutboxEvent)
        .update(
          {
            id: event.id,
            status: 'processing',
            lockedBy: this.instanceId,
          },
          {
            status: 'published',

            // Dùng đồng hồ MySQL.
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
          `Cannot mark event as published: ${event.id}`,
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
  // 6. HANDLE PUBLISH FAILURE
  // ==========================================

  private async handlePublishFailure(
    event: OutboxEvent,
    error: unknown,
  ): Promise<void> {
    const retryCount = event.retryCount + 1;

    // Đã đạt giới hạn retry thì chuyển sang dead.
    const isDead = retryCount >= this.maxRetries;

    // ------------------------------------------
    // Exponential Backoff
    // 1s -> 2s -> 4s -> 8s -> 16s -> 32s -> 60s
    // ------------------------------------------

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

    // ------------------------------------------
    // Cập nhật lại Outbox
    // ------------------------------------------

    const result = await this.dataSource
      .getRepository(OutboxEvent)
      .update(
        {
          id: event.id,
          status: 'processing',
          lockedBy: this.instanceId,
        },
        {
          status: isDead ? 'dead' : 'pending',

          retryCount,

          // Sử dụng thời gian MySQL để lên lịch retry.
          // delayMs là hằng số do chương trình tính toán.
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
        `Cannot update failed outbox event: ${event.id}`,
      );

      return;
    }

    // ------------------------------------------
    // Ghi log kết quả retry
    // ------------------------------------------

    if (isDead) {
      this.logger.error(
        `Outbox event moved to dead: ` +
        `${event.eventType}, ${event.id}, ` +
        `retryCount=${retryCount}`,
      );
    } else {
      this.logger.warn(
        `Retry scheduled ${retryCount}/${this.maxRetries}: ` +
        `${event.eventType}, ` +
        `next attempt in ${delayMs}ms`,
      );
    }
  }
}
