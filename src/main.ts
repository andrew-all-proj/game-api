import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import * as gameDb from 'game-db'
import { ValidationPipe } from '@nestjs/common'
import config from './config'

async function bootstrap() {
  try {
    if (config.local) {
      gameDb.AppDataSource.setOptions({
        ...gameDb.AppDataSource.options,
        logging: true,
      })
    }

    await gameDb.AppDataSource.initialize()
    console.log(config.botServiceUrl)
    console.log('Database connected')
  } catch (error) {
    console.error('Database connection failed', error)
    process.exit(1)
  }

  const app = await NestFactory.create(AppModule)

  app.enableCors()
  app.useGlobalPipes(new ValidationPipe())

  await app.listen(config.port, '0.0.0.0')
}
bootstrap()
