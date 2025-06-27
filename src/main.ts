import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import * as gameDb from 'game-db'
import { ValidationPipe } from '@nestjs/common'
import config from './config'
import { createWinstonLogger } from './config/winston'
import { WinstonModule } from 'nest-winston'

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

  app.enableCors()
  app.useGlobalPipes(new ValidationPipe())

  await app.listen(config.port, '0.0.0.0')
  logger.log('info', `App running on port ${config.port}`)
}
bootstrap()
