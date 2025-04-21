import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import * as gameDb from 'game-db'
import { ValidationPipe } from '@nestjs/common'

async function bootstrap() {
  try {
    await gameDb.AppDataSource.initialize()
    console.log('Database connected')
  } catch (error) {
    console.error('Database connection failed', error)
    process.exit(1)
  }

  const app = await NestFactory.create(AppModule)

  app.enableCors()

  app.useGlobalPipes(new ValidationPipe())
  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
