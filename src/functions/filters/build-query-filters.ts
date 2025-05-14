import { FindOptionsWhere, ILike, In } from 'typeorm'

export const buildQueryFilters = <T>(args: any): FindOptionsWhere<T> => {
  const where: FindOptionsWhere<T> = {}

  for (const key in args) {
    if (key === 'offset' || key === 'limit' || key === 'sortOrder') continue

    const filter = args[key]

    if (!filter) continue

    if (typeof filter === 'object' && (filter.eq || filter.like || filter.in)) {
      if (filter.eq !== undefined) {
        where[key] = filter.eq
      } else if (filter.like !== undefined) {
        where[key] = ILike(`%${filter.like}%`)
      } else if (filter.in !== undefined) {
        where[key] = In(filter.in)
      }
    } else {
      where[key] = filter
    }
  }

  return where
}
