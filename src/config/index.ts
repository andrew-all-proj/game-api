import * as dotenv from 'dotenv'

dotenv.config()

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN not specified in .env')
}

export default {
  botToken: process.env.BOT_TOKEN,
  local: process.env.LOCAL,
  port: Number(process.env.PORT) || 3000,
}
