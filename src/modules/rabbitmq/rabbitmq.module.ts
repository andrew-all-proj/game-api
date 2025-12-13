import { Module } from '@nestjs/common'
import { ClientsModule, Transport } from '@nestjs/microservices'
import config from '../../config'

export const RABBITMQ_BATTLE_CLIENT = 'RABBITMQ_BATTLE_CLIENT'

@Module({
  imports: [
    ClientsModule.register([
      {
        name: RABBITMQ_BATTLE_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: [
            `amqp://${config.rabbitMq.user}:${config.rabbitMq.password}` +
              `@${config.rabbitMq.host}:${config.rabbitMq.port}`,
          ],
          queue: config.rabbitMq.queue,
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class RabbitMqModule {}
