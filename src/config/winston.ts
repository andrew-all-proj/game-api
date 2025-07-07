import { utilities as nestWinstonModuleUtilities } from 'nest-winston'
import * as winston from 'winston'
import { ElasticsearchTransport } from 'winston-elasticsearch'

export function createWinstonLogger() {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        nestWinstonModuleUtilities.format.nestLike('NestApp', { prettyPrint: true }),
      ),
    }),
  ]

  try {
    const esTransport = new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
        auth: {
          username: process.env.ELASTIC_USERNAME || '',
          password: process.env.ELASTIC_PASSWORD || '',
        },
      },
      indexPrefix: 'api',
    })

    transports.push(esTransport)
  } catch (error) {
    console.warn('⚠️ Elasticsearch transport disabled:', (error as Error).message)
  }

  return {
    transports,
  }
}

export function createWinstonLoggerBattle() {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        nestWinstonModuleUtilities.format.nestLike('NestApp', { prettyPrint: true }),
      ),
    }),
  ]

  try {
    const esTransport = new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
        auth: {
          username: process.env.ELASTIC_USERNAME || '',
          password: process.env.ELASTIC_PASSWORD || '',
        },
      },
      indexPrefix: 'battles',
    })

    transports.push(esTransport)
  } catch (error) {
    console.warn('⚠️ Elasticsearch transport disabled:', (error as Error).message)
  }

  return {
    transports,
  }
}
