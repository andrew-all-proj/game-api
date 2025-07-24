/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
//TODO add type
import * as common from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { GqlExecutionContext } from '@nestjs/graphql'
import { ROLES_KEY } from './roles.decorator'

@common.Injectable()
export class RolesGuard implements common.CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: common.ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles) return true

    const ctx = GqlExecutionContext.create(context)
    const gqlCtx = ctx.getContext()

    const user = gqlCtx.req?.user

    if (!user || !user.role) {
      throw new common.ForbiddenException('Access denied: no user or roles found')
    }

    const hasRole = requiredRoles.some((role) => user.role === role)
    if (!hasRole) {
      throw new common.ForbiddenException('Access denied: insufficient role')
    }

    return true
  }
}
