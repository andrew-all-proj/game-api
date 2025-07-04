import * as gameDb from 'game-db'

export interface AuthenticatedRequest extends Request {
  user: {
    id: string
    role: gameDb.datatypes.UserRoleEnum
    email?: string
  }
}

export interface GraphQLContext {
  req: AuthenticatedRequest
}
