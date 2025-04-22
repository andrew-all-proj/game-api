import { registerEnumType } from '@nestjs/graphql'
import * as gameDb from 'game-db'

registerEnumType(gameDb.datatypes.UserRoleEnum, {
  name: 'UserRoleEnum',
})
