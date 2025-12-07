import { GraphQLResolveInfo, Kind, SelectionNode } from 'graphql'
import { EntityMetadata } from 'typeorm/metadata/EntityMetadata'

interface GraphQLField<T> {
  selectedFields: (keyof T)[]
  relations: string[]
}

export function extractSelectedFieldsAndRelations<T>(
  info: GraphQLResolveInfo,
  rootEntity: { getRepository: () => { metadata: EntityMetadata } },
): GraphQLField<T> {
  const selectedFields = new Set<keyof T>()
  const relations = new Set<string>()

  const metadata = rootEntity.getRepository().metadata

  function traverse(selections: readonly SelectionNode[], path = '', metadataArg: EntityMetadata = metadata) {
    const relationNames = metadataArg.relations.map((r) => r.propertyName)
    const columnNames = metadataArg.columns.map((c) => c.propertyName)

    for (const selection of selections) {
      if (selection.kind !== Kind.FIELD) continue

      const nameValue = selection.name.value
      const name = nameValue as keyof T

      if (['items', 'totalCount', '__typename'].includes(name as string) && !path) {
        if (selection.selectionSet) {
          traverse(selection.selectionSet.selections, path, metadataArg)
        }
        continue
      }

      const currentPath = path ? `${path}.${nameValue}` : nameValue

      if (selection.selectionSet) {
        if (relationNames.includes(nameValue)) {
          relations.add(currentPath)
          const nextRelation = metadataArg.relations.find((r) => r.propertyName === nameValue)
          if (nextRelation && nextRelation.inverseEntityMetadata) {
            traverse(selection.selectionSet.selections, currentPath, nextRelation.inverseEntityMetadata)
          }
        }
      } else {
        if (columnNames.includes(nameValue)) {
          selectedFields.add(currentPath as keyof T)
        }
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
