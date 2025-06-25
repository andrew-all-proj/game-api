import * as dotenv from 'dotenv'

dotenv.config()

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN not specified in .env')
}

if (!process.env.FILE_UPLOAD_DIR) {
  throw new Error('FILE_UPLOAD_DIR not specified in .env')
}

export default {
  botToken: process.env.BOT_TOKEN,
  local: process.env.LOCAL,
  port: Number(process.env.PORT) || 3000,
  fileUrlPrefix: process.env.FILE_URL_PREFIX,
  fileUploadDir: process.env.FILE_UPLOAD_DIR,
  botServiceUrl: process.env.BOT_SERVICE_URL,
  botServiceToken: process.env.BOT_SERVICE_TOKEN,
  redisConnect: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
}
