import { Injectable } from '@nestjs/common'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'
import { logger } from '../../functions/logger'
import { EmailNotificationService } from './email-notification.service'
import { NotificationPayload, NotificationType } from './notification.types'
import { TelegramNotificationService } from './telegram-notification.service'

@Injectable()
export class NotificationService {
  private readonly channels: Partial<Record<NotificationType, { send(payload: NotificationPayload): Promise<void> }>>

  constructor(
    private readonly telegramService: TelegramNotificationService,
    private readonly emailService: EmailNotificationService,
  ) {
    this.channels = {
      [NotificationType.TELEGRAM]: this.telegramService,
      [NotificationType.EMAIL]: this.emailService,
    }
  }

  async sendNotification(payload: NotificationPayload): Promise<CommonResponse> {
    const channel = this.channels[payload.type]

    try {
      if (!channel) {
        throw new Error(`Unsupported notification type: ${payload.type}`)
      }
      await channel.send(payload)
      return { success: true }
    } catch (err) {
      logger.error('Failed to emit notification', err as Error)
      return { success: false, error: { message: 'Failed to emit notification', error: (err as Error).message } }
    }
  }
}
