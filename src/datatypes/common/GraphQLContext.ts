export interface AuthenticatedRequest extends Request {
  user: {
    id: string
    role: string
    email?: string
  }
}

export interface GraphQLContext {
  req: AuthenticatedRequest
}
