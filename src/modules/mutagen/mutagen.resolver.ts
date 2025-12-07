import { Resolver, Context, ResolveField, Parent } from '@nestjs/graphql'
import * as gameDb from 'game-db'
import { GraphQLContext } from '../../datatypes/common/GraphQLContext'
import { Mutagen } from './entities/mutagen'

@Resolver(() => Mutagen)
export class MutagenResolver {
  constructor() {}

  @ResolveField(() => String, { nullable: true })
  name(@Parent() skill: Mutagen, @Context() ctx: GraphQLContext): string | null {
    const lang = ctx.language ?? ctx.req.user?.language ?? gameDb.datatypes.UserLanguage.EN

    const translations = skill.translations ?? []

    const tr =
      translations.find((t) => t.language === lang) ||
      translations.find((t) => t.language === gameDb.datatypes.UserLanguage.EN)

    return tr?.name ?? skill.name ?? null
  }

  @ResolveField(() => String, { nullable: true })
  description(@Parent() skill: Mutagen, @Context() ctx: GraphQLContext): string | null {
    const lang = ctx.language ?? ctx.req.user?.language ?? gameDb.datatypes.UserLanguage.EN

    const translations = skill.translations ?? []

    const tr =
      translations.find((t) => t.language === lang) ||
      translations.find((t) => t.language === gameDb.datatypes.UserLanguage.EN)

    return tr?.description ?? skill.description ?? null
  }
}
