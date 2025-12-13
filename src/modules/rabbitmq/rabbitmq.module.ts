import { Module } from '@nestjs/common'
import { ClientsModule, Transport } from '@nestjs/microservices'
import config from '../../config'

export const RABBITMQ_BATTLE_CLIENT = 'RABBITMQ_BATTLE_CLIENT'

export const buildRabbitUrls = (): string[] => {
  const envUrl = process.env.RABBITMQ_URL
  if (envUrl) {
    return envUrl
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u.length > 0)
  }

  const user = config.rabbitMq.user
  const password = config.rabbitMq.password
  const port = config.rabbitMq.port

  let host = (config.rabbitMq.host || '').trim()

  // If host is already a full amqp(s) URL, return as-is
  if (/^amqps?:\/\//i.test(host)) {
    return [host]
  }

  // If host accidentally contains a protocol (like "localhost:tcp://10.0.0.1"), keep the last segment
  if (host.includes('://')) {
    host = host.split('://').pop() || host
  }

  // Strip stray protocol markers
  host = host.replace(/^tcp:\/\//i, '').replace(/^amqps?:\/\//i, '')

  return [`amqp://${user}:${password}@${host}:${port}`]
}

@Module({
  imports: [
    ClientsModule.register([
      {
        name: RABBITMQ_BATTLE_CLIENT,
        transport: Transport.RMQ,
        options: {
          urls: buildRabbitUrls(),
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
