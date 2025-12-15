import { Inject, Injectable } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import { lastValueFrom } from 'rxjs'
import { RABBITMQ_BATTLE_CLIENT } from '../rabbitmq/rabbitmq.module'
import { NotificationChannel, NotificationPayload } from './notification.types'
import * as gameDb from 'game-db'
import { In } from 'typeorm'
import { logger } from '../../functions/logger'

@Injectable()
export class TelegramNotificationService implements NotificationChannel {
  constructor(@Inject(RABBITMQ_BATTLE_CLIENT) private readonly client: ClientProxy) {}

  async send(payload: NotificationPayload): Promise<void> {
    const users = await gameDb.Entities.User.find({
      where: { id: In(payload.userIds) },
      select: ['id', 'telegramId'],
    })

    const recipients = users.filter((u) => !!u.telegramId)

    if (!recipients.length) {
      logger.warn('No telegram recipients found for notification', { userIds: payload.userIds })
      return
    }

    await this.client.connect()

    for (const user of recipients) {
      const messagePayload = {
        userId: user.id,
        telegramId: user.telegramId,
        message: payload.message,
        publishAt: payload.publishAt,
      }
      await lastValueFrom(this.client.emit('notification.telegram', messagePayload))
    }
  }
}
