import * as gameDb from 'game-db'

export interface AuthenticatedRequest extends Request {
  user: {
    id: string
    role: gameDb.datatypes.UserRoleEnum
    email?: string
    language?: gameDb.datatypes.UserLanguage
  }
}

export interface GraphQLContext {
  req: AuthenticatedRequest
  language?: gameDb.datatypes.UserLanguage
}
