export interface JwtPayload {
  user?: {
    id: string
    email: string
    role: string
  }
}
