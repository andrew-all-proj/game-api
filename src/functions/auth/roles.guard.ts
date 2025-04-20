import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { GqlExecutionContext } from '@nestjs/graphql'
import { ROLES_KEY } from './roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles) return true

    const ctx = GqlExecutionContext.create(context)
    const req = ctx.getContext().req

    const user = req.user
    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: no user or roles found')
    }

    const hasRole = requiredRoles.some((role) => user.role === role)
    if (!hasRole) {
      throw new ForbiddenException('Access denied: insufficient role')
    }

    return true
  }
}
