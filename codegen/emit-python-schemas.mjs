// Emit generated/python/bundle_schemas.py — a typed column descriptor per produced
// table. Library-agnostic on purpose (no pyarrow import here): the producer maps the
// string ArrowType token → its own pyarrow field builder once, then builds every table
// schema from these descriptors instead of hand-declaring them. Mirrors BundleSchemas.cs.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, GENERATED_HEADER, tableColumns } from './lib/duck.mjs'
import { mapType } from './lib/types.mjs'

export function emitPythonSchemas() {
  const cols = tableColumns()
  const byTable = {}
  for (const c of cols) (byTable[c.table_name] ??= []).push(c)

  const tableBlocks = Object.entries(byTable)
    .map(([table, cs]) => {
      const fields = cs
        .map(
          (c) =>
            `        ColumnSpec("${c.column_name}", "${mapType(c.data_type).py}", ${c.is_nullable ? 'True' : 'False'}),`
        )
        .join('\n')
      return `    "${table}": [\n${fields}\n    ],`
    })
    .join('\n')

  const out =
    GENERATED_HEADER('py') +
    `"""Per-table parquet column descriptors (names, arrow type tokens, nullability).

ArrowType is a string token ("int32" | "int64" | "string" | "float64" | "bool" |
"binary"); the producer maps it to a pyarrow type once. Keeps this generated module
dependency-free. Single source of truth: speckle-bundle-spec/spec/bundle-spec.sql.
"""

from typing import NamedTuple


class ColumnSpec(NamedTuple):
    name: str
    type: str  # arrow type token; see module docstring
    nullable: bool


# table name -> ordered column descriptors (matches the parquet field order producers write).
BY_TABLE: dict[str, list[ColumnSpec]] = {
${tableBlocks}
}
`

  const dir = join(REPO, 'generated', 'python')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'bundle_schemas.py'), out)
  return join(dir, 'bundle_schemas.py')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitPythonSchemas())
