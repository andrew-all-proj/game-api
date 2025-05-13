import { registerEnumType } from '@nestjs/graphql'
import * as gameDb from 'game-db'
import { SortOrderEnum } from '../datatypes/common/SortOrderEnum'

registerEnumType(gameDb.datatypes.UserRoleEnum, {
  name: 'UserRoleEnum',
})

registerEnumType(gameDb.datatypes.FileTypeEnum, {
  name: 'FileTypeEnum',
})

registerEnumType(gameDb.datatypes.ContentTypeEnum, {
  name: 'ContentTypeEnum',
})

registerEnumType(SortOrderEnum, {
  name: 'SortOrderEnum',
})
