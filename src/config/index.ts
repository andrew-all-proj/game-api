import * as dotenv from 'dotenv'

dotenv.config()

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN not specified in .env')
}

export default {
  botToken: process.env.BOT_TOKEN,
  local: process.env.LOCAL,
  port: Number(process.env.PORT) || 3000,
  fileUrlPrefix: process.env.FILE_URL_PREFIX,
  botServiceUrl: process.env.BOT_SERVICE_URL,
  botServiceToken: process.env.BOT_SERVICE_TOKEN,
  redisConnect: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  s3: {
    key: process.env.S3_KEY,
    secret: process.env.S3_SECRET,
    bucket: process.env.S3_BUCKET,
    prefix: process.env.S3_PREFIX || 'testing',
  },
  rabbitMq: {
    user: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: process.env.RABBITMQ_PORT || '5672',
    queue: process.env.RABBITMQ_QUEUE || 'queue',
    queueApi: process.env.RABBITMQ_QUEUE_API || 'queue',
  },
} as const
