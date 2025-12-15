import { Module } from '@nestjs/common'
import { NotificationResolver } from './notification.resolver'
import { NotificationService } from './notification.service'
import { RabbitMqModule } from '../rabbitmq/rabbitmq.module'
import { EmailNotificationService } from './email-notification.service'
import { TelegramNotificationService } from './telegram-notification.service'

@Module({
  imports: [RabbitMqModule],
  providers: [NotificationResolver, NotificationService, TelegramNotificationService, EmailNotificationService],
})
export class NotificationModule {}
