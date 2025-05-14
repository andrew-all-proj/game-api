import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import * as gameDb from 'game-db'
import { ValidationPipe } from '@nestjs/common'
import { DataSource } from 'typeorm'
import config from './config'

async function bootstrap() {
  try {
    let dataSourceOptions = { ...gameDb.AppDataSource.options }
    if (config.local) {
      dataSourceOptions = { ...gameDb.AppDataSource.options, logging: true }
    }
    const dataSource = new DataSource(dataSourceOptions)
    await dataSource.initialize()
    console.log('Database connected')
  } catch (error) {
    console.error('Database connection failed', error)
    process.exit(1)
  }

  const app = await NestFactory.create(AppModule)

  app.enableCors()

  app.useGlobalPipes(new ValidationPipe())
  await await app.listen(config.port, '0.0.0.0')
}
bootstrap()
