// Emit generated/csharp/BundleRows.cs — one record per row-shaped table, in DDL column
// order. Producers construct one instead of passing a dozen loose scalars, and the 1:1
// column correspondence is what stops a writer silently reordering them. Positional
// records only: init-only setters break net48 consumers of the ILRepack'd
// netstandard2.0 assembly (CS0570).
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, GENERATED_HEADER } from './lib/duck.mjs'
import { mapType, pascal } from './lib/types.mjs'
import { tableRows } from './lib/tables.mjs'

const clr = (f) => {
  const t = mapType(f.duckType).clr
  return f.optional ? `${t}?` : t
}

export function emitCsharpTables() {
  const records = tableRows()
    .map((t) => {
      const params = t.fields
        .map((f) => `${clr(f)} ${pascal(f.column)}${f.defaulted ? ' = null' : ''}`)
        .join(', ')
      const cols = t.fields.map((f) => f.column).join('</c>, <c>')
      return (
        `/// <summary>One <c>${t.table}</c> row, in column order. Columns: <c>${cols}</c>.</summary>\n` +
        `public sealed record ${t.typeName}(${params});`
      )
    })
    .join('\n\n')

  const out =
    GENERATED_HEADER('cs') +
    `namespace Speckle.Bundle.Spec;

${records}
`

  const dir = join(REPO, 'generated', 'csharp')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'BundleRows.cs'), out)
  return join(dir, 'BundleRows.cs')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitCsharpTables())
