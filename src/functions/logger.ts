import { createWinstonLogger, createWinstonLoggerBattle } from '../config/winston'
import * as winston from 'winston'

export const logger: winston.Logger = winston.createLogger({
  level: 'info',
  ...createWinstonLogger(),
})

export const logBattle: winston.Logger = winston.createLogger({
  level: 'info',
  ...createWinstonLoggerBattle(),
})
