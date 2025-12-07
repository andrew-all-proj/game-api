import { Resolver, Context, ResolveField, Parent } from '@nestjs/graphql'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { Energy } from './entities/energy'

@Resolver(() => Energy)
export class EnergyResolver {
  constructor() {}

  @ResolveField(() => String, { nullable: true })
  name(@Parent() energy: Energy, @Context() ctx: GraphQLContext): string | null {
    const lang = ctx.language ?? ctx.req.user?.language ?? gameDb.datatypes.UserLanguage.EN

    const translations = energy.translations ?? []

    const tr =
      translations.find((t) => t.language === lang) ||
      translations.find((t) => t.language === gameDb.datatypes.UserLanguage.EN)

    return tr?.name ?? energy.name ?? null
  }
}
