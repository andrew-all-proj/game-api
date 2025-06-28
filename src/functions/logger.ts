import { createWinstonLogger } from '../config/winston'
import * as winston from 'winston'

export const logger: winston.Logger = winston.createLogger({
  level: 'info',
  ...createWinstonLogger(),
})
