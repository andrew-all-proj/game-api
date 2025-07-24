import * as gameDb from 'game-db'
import { GraphQLContext } from '../datatypes/common/GraphQLContext'

export const resolveUserIdByRole = (
  role: gameDb.datatypes.UserRoleEnum,
  ctx: GraphQLContext,
  userId?: string | null,
): string | undefined => {
  if (role === gameDb.datatypes.UserRoleEnum.USER) {
    return ctx.req.user.id
  }
  return userId || undefined
}
