import { Inject, Injectable } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import { RABBITMQ_BATTLE_CLIENT } from '../rabbitmq/rabbitmq.module'
import { NotificationChannel, NotificationPayload } from './notification.types'

@Injectable()
export class EmailNotificationService implements NotificationChannel {
  constructor(@Inject(RABBITMQ_BATTLE_CLIENT) private readonly client: ClientProxy) {}

  async send(payload: NotificationPayload): Promise<void> {
    // Stub until email channel is implemented
    throw new Error('Email notifications are not implemented yet')
  }
}
