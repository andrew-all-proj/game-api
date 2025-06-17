import { Module } from '@nestjs/common'
import createClient from 'ioredis'
import config from '../config'

@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new createClient({
          host: config.redisConnect.host,
          port: config.redisConnect.port,
          password: config.redisConnect.password,
        })
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
