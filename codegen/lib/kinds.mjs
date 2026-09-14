// Per-kind node field sets: node_kinds.columns joined to the physical nodes DDL.
// The CSV is the only place that says WHICH of the wide nodes row a kind populates
// and which of those may be NULL — a `?` suffix marks the field optional.
import { nodeKinds, tableColumns } from './duck.mjs'

/** Live kinds as { id, name, description, fields: [{ column, duckType, optional }] }. */
export function nodeKindFields() {
  const nodeCols = new Map(
    tableColumns()
      .filter((c) => c.table_name === 'nodes')
      .map((c) => [c.column_name, c])
  )

  return nodeKinds()
    .filter((k) => k.status !== 'retired')
    .map((k) => {
      const fields = (k.columns ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((token) => {
          const optional = token.endsWith('?')
          const column = optional ? token.slice(0, -1) : token
          const col = nodeCols.get(column)
          if (!col)
            throw new Error(
              `node_kinds.columns for ${k.name} names "${column}", which the nodes table does not have`
            )
          return { column, duckType: col.data_type, optional }
        })
      if (fields.length === 0) throw new Error(`live node kind ${k.name} declares no columns`)
      return { id: k.id, name: k.name, description: k.description, fields }
    })
}
