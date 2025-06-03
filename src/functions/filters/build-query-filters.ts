import { FindOptionsWhere, ILike, In, MoreThanOrEqual, LessThanOrEqual } from 'typeorm'

export const buildQueryFilters = <T>(args: any): FindOptionsWhere<T> => {
  const where: FindOptionsWhere<T> = {}

  for (const key in args) {
    if (key === 'offset' || key === 'limit' || key === 'sortOrder') continue

    const filter = args[key]

    if (!filter) continue

    if (
      typeof filter === 'object' &&
      (filter.eq !== undefined ||
        filter.like !== undefined ||
        filter.in !== undefined ||
        filter.gte !== undefined ||
        filter.lte !== undefined)
    ) {
      if (filter.eq !== undefined) {
        where[key] = filter.eq
      }
      if (filter.like !== undefined) {
        where[key] = ILike(`%${filter.like}%`)
      }
      if (filter.in !== undefined) {
        where[key] = In(filter.in)
      }
      if (filter.gte !== undefined || filter.lte !== undefined) {
        where[key] = {}
        if (filter.gte !== undefined) {
          where[key] = { ...(where[key] as object), ...MoreThanOrEqual(filter.gte) }
        }
        if (filter.lte !== undefined) {
          where[key] = { ...(where[key] as object), ...LessThanOrEqual(filter.lte) }
        }
      }
    } else {
      where[key] = filter
    }
  }

  return where
}
