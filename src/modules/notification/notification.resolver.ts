import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { UseGuards } from '@nestjs/common'
import * as gameDb from 'game-db'
import { CommonResponse } from '../../datatypes/entities/CommonResponse'
import { GqlAuthGuard, Roles, RolesGuard } from '../../functions/auth'
import { SendNotificationArgs } from './dto/send-notification.args'
import { NotificationService } from './notification.service'
import { NotificationPayload } from './notification.types'

@Resolver()
export class NotificationResolver {
  constructor(private readonly notificationService: NotificationService) {}

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(gameDb.datatypes.UserRoleEnum.SUPER_ADMIN, gameDb.datatypes.UserRoleEnum.ADMIN)
  @Mutation(() => CommonResponse)
  async SendNotification(@Args() args: SendNotificationArgs): Promise<CommonResponse> {
    const publishAt = args.publishAt ?? new Date().toISOString()
    const payload: NotificationPayload = {
      type: args.type,
      message: args.message,
      publishAt,
      userIds: args.userIds,
    }

    return this.notificationService.sendNotification(payload)
  }
}
