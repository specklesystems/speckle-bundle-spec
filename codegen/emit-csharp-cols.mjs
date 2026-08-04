// Emit generated/csharp/BundleCols.cs — NAMED column-index constants per produced
// table, so the managed writer addresses its column arrays by name instead of
// hard-coded ordinals. A spec column INSERTION shifts these automatically; a
// rename/removal breaks the consumer's compile — the writer cannot silently
// drift from the schema it builds via BundleSchemas.cs. Mirrors bundle_cols.h.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, GENERATED_HEADER, tableColumns } from './lib/duck.mjs'
import { camel } from './lib/types.mjs'

const pascal = (s) => {
  const c = camel(s)
  return c.charAt(0).toUpperCase() + c.slice(1)
}

export function emitCsharpCols() {
  const cols = tableColumns()
  const byTable = {}
  for (const c of cols) (byTable[c.table_name] ??= []).push(c)

  const classes = Object.entries(byTable)
    .map(([table, cs]) => {
      const consts = cs
        .map((c, i) => `        public const int ${pascal(c.column_name)} = ${i};`)
        .join('\n')
      return (
        `    public static class ${pascal(table)}\n    {\n` +
        `${consts}\n` +
        `        public const int ColumnCount = ${cs.length};\n` +
        `    }`
      )
    })
    .join('\n\n')

  const out =
    GENERATED_HEADER('cs') +
    `namespace Speckle.Bundle.Spec;

/// <summary>
/// Column index of every produced table's parquet field, in spec order (matches
/// the <see cref="BundleSchemas"/> descriptor order 1:1).
/// </summary>
public static class BundleCols
{
${classes}
}
`

  const dir = join(REPO, 'generated', 'csharp')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'BundleCols.cs'), out)
  return join(dir, 'BundleCols.cs')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitCsharpCols())
