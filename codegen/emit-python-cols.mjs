// Emit generated/python/bundle_cols.py — NAMED column-index constants per produced
// table, so the specklepy producer addresses its column arrays by name instead of
// hard-coded ordinals. A spec column INSERTION shifts these automatically; a
// rename/removal breaks the consumer's imports. Mirrors bundle_cols.h / BundleCols.cs.
// Zero runtime deps so it vendors cleanly into specklepy.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, GENERATED_HEADER, tableColumns } from './lib/duck.mjs'
import { snake } from './lib/types.mjs'

export function emitPythonCols() {
  const cols = tableColumns()
  const byTable = {}
  for (const c of cols) (byTable[c.table_name] ??= []).push(c)

  const classes = Object.entries(byTable)
    .map(([table, cs]) => {
      const consts = cs
        .map((c, i) => `    ${snake(c.column_name).toUpperCase()} = ${i}`)
        .join('\n')
      return (
        `class ${snake(table).toUpperCase()}:\n` +
        `    """Column indices of the ${table} table (spec order)."""\n\n` +
        `${consts}\n` +
        `    COLUMN_COUNT = ${cs.length}`
      )
    })
    .join('\n\n\n')

  const out =
    GENERATED_HEADER('py') +
    `"""Column index of every produced table's parquet field, in spec order (matches
the bundle_schemas.BY_TABLE descriptor order 1:1). One class per table; use these
instead of hard-coded ordinals so a spec column insertion shifts writers
automatically and a rename/removal fails their imports.
"""

${classes}
`

  const dir = join(REPO, 'generated', 'python')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'bundle_cols.py'), out)
  return join(dir, 'bundle_cols.py')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitPythonCols())
