import { GraphQLResolveInfo, SelectionNode } from 'graphql'

interface GraphQLField<T> {
  selectedFields: (keyof T)[]
  relations: string[]
}

export function extractSelectedFieldsAndRelations<T>(
  info: GraphQLResolveInfo,
  rootEntity: { getRepository: () => any },
): GraphQLField<T> {
  const selectedFields = new Set<keyof T>()
  const relations = new Set<string>()

  const relationNames = rootEntity.getRepository().metadata.relations.map((r) => r.propertyName)

  function traverse(selections: readonly SelectionNode[], path = '') {
    for (const selection of selections) {
      if (selection.kind !== 'Field') continue

      const name = selection.name.value as keyof T

      if (['items', 'totalCount', '__typename'].includes(name as string) && !path) {
        if (selection.selectionSet) {
          traverse(selection.selectionSet.selections, path)
        }
        continue
      }

      if (selection.selectionSet) {
        const root = path || (name as string)
        if (relationNames.includes(name as string)) {
          relations.add(root)
        }
      } else {
        selectedFields.add(name)
      }
    }
  }

  const selections = info.fieldNodes[0]?.selectionSet?.selections || []
  traverse(selections)

  return {
    selectedFields: Array.from(selectedFields),
    relations: Array.from(relations),
  }
}
