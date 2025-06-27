import { createWinstonLogger } from '../config/winston'
import * as winston from 'winston'

//USE ONLY FOR FUNCTION IN MODULE USE  @Inject(WINSTON_MODULE_NEST_PROVIDER)
export const logger: winston.Logger = winston.createLogger({
  level: 'info',
  ...createWinstonLogger(),
})
