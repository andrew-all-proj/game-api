import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { FileModule } from './modules/file/file.module'
import { UserModule } from './modules/user/user.module'
import { UploadModule } from './modules/upload-file/upload-file.module'
import { MonsterModule } from './modules/monster/monster.module'
import { GraphQLModule } from '@nestjs/graphql'
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo'
import { AdminUserModule } from './modules/admin-user/admin-user.module'
import './modules/register-enum-type'
import { BattleSearchModule } from './modules/battle-search/battle-search.module'
import { MonsterBattlesModule } from './modules/monster-battles/monster-battles.module'
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default'
import { BattleModule } from './modules/battle/battle.module'
import { WinstonModule } from 'nest-winston'
import { createWinstonLogger } from './config/winston'
import { logger } from './functions/logger'
import { UserInventoryModule } from './modules/user-inventory/user-inventory.module'
import { PlaygroundController } from './playground.controller'

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string }
}

const isProd = process.env.NODE_ENV === 'production'
const allowIntrospection = !isProd || process.env.GQL_INTROSPECTION === 'true'
const allowPlayground = !isProd || process.env.GQL_PLAYGROUND === 'true'

@Module({
  imports: [
    AdminUserModule,
    BattleModule,
    BattleSearchModule,
    MonsterBattlesModule,
    FileModule,
    MonsterModule,
    UserModule,
    UploadModule,
    UserInventoryModule,
    WinstonModule.forRoot(createWinstonLogger()),

    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      path: '/graphql',
      autoSchemaFile: 'schema.gql',
      sortSchema: true,

      introspection: allowIntrospection,
      playground: false,
      plugins: allowPlayground ? [ApolloServerPluginLandingPageLocalDefault({ embed: true })] : [],

      context: ({ req }: { req: AuthenticatedRequest }) => {
        const user = req.user
        return { user, req }
      },

      formatError: (error) => {
        logger.error('GraphQL Error', {
          message: error.message,
          path: error.path,
          extensions: error.extensions,
        })
        return error
      },
    }),
  ],
  controllers: [AppController, PlaygroundController],
  providers: [AppService],
  exports: [WinstonModule],
})
export class AppModule {}
