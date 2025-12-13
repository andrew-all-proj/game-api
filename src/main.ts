import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import * as gameDb from 'game-db'
import { ValidationPipe } from '@nestjs/common'
import config from './config'
import { createWinstonLogger } from './config/winston'
import { WinstonModule } from 'nest-winston'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'

async function bootstrap() {
  const logger = WinstonModule.createLogger(createWinstonLogger())

  try {
    if (config.local) {
      gameDb.AppDataSource.setOptions({
        ...gameDb.AppDataSource.options,
        logging: true,
      })
    }

    await gameDb.AppDataSource.initialize()
    logger.log('info', 'Database connected')
  } catch (error) {
    logger.error('Database connection failed', error)
    process.exit(1)
  }

  const app = await NestFactory.create(AppModule, {
    logger,
  })

  const rabbitMqUrl =
    `amqp://${config.rabbitMq.user}:${config.rabbitMq.password}` + `@${config.rabbitMq.host}:${config.rabbitMq.port}`

  const rabbitMqQueue = config.rabbitMq.queueApi

  try {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rabbitMqUrl],
        queue: rabbitMqQueue,
        queueOptions: {
          durable: true,
        },
      },
    })

    await app.startAllMicroservices()
    logger.log('info', `RabbitMQ microservice connected (queue: ${rabbitMqQueue})`)
  } catch (error) {
    logger.error('RabbitMQ connection failed', error)
  }

  app.enableCors()
  app.useGlobalPipes(new ValidationPipe())

  await app.listen(config.port, '0.0.0.0')
  logger.log('info', `App running on port ${config.port}`)
}

bootstrap().catch((error) => {
  console.error(error)
})
