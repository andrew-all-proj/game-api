/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { FindOptionsWhere, ILike, In, MoreThanOrEqual, LessThanOrEqual, Not } from 'typeorm'

type FilterPrimitive = string | number | boolean | undefined

interface FilterValue {
  eq?: FilterPrimitive
  neq?: FilterPrimitive
  like?: string
  in?: FilterPrimitive[]
  gte?: FilterPrimitive
  lte?: FilterPrimitive
}

export type Filters = Record<string, FilterValue | FilterPrimitive>

export const buildQueryFilters = <T>(args: Filters): FindOptionsWhere<T> => {
  const where: FindOptionsWhere<T> = {}

  for (const key in args) {
    if (key === 'offset' || key === 'limit' || key === 'sortOrder') continue

    const filter = args[key]

    if (!filter && filter !== 0 && filter !== false) continue // пропускать только null/undefined

    if (
      typeof filter === 'object' &&
      filter !== null &&
      ('eq' in filter || 'neq' in filter || 'like' in filter || 'in' in filter || 'gte' in filter || 'lte' in filter)
    ) {
      const value = filter

      if (value.eq !== undefined) {
        where[key] = value.eq as any
      }
      if (value.neq !== undefined) {
        where[key] = Not(value.neq as any)
      }
      if (value.like !== undefined) {
        where[key] = ILike(`%${value.like}%`)
      }
      if (value.in !== undefined) {
        where[key] = In(value.in as any)
      }
      if (value.gte !== undefined || value.lte !== undefined) {
        let range: any = {}
        if (value.gte !== undefined) {
          range = { ...range, ...MoreThanOrEqual(value.gte) }
        }
        if (value.lte !== undefined) {
          range = { ...range, ...LessThanOrEqual(value.lte) }
        }
        where[key] = range
      }
    } else {
      where[key] = filter as any
    }
  }

  return where
}
