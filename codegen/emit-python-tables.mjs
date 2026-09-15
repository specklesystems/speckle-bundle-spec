// Emit generated/python/bundle_rows.py — one frozen dataclass per row-shaped table.
// Mirrors BundleRows.cs: DDL column order, defaults only on the trailing nullable run.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, GENERATED_HEADER } from './lib/duck.mjs'
import { mapType } from './lib/types.mjs'
import { tableRows } from './lib/tables.mjs'

export function emitPythonTables() {
  const classes = tableRows()
    .map((t) => {
      const fields = t.fields
        .map((f) => {
          const ty = mapType(f.duckType).pyType
          const hint = f.optional ? `${ty} | None` : ty
          return `    ${f.column}: ${hint}${f.defaulted ? ' = None' : ''}`
        })
        .join('\n')
      return (
        `@dataclass(frozen=True)\nclass ${t.typeName}:\n` +
        `    """One ${t.table} row, in column order."""\n\n${fields}`
      )
    })
    .join('\n\n\n')

  const out =
    GENERATED_HEADER('py') +
    `"""One record per row-shaped table, carrying its columns in DDL order.

Single source of truth: speckle-bundle-spec/spec/bundle-spec.sql.
"""

from dataclasses import dataclass


${classes}
`

  const dir = join(REPO, 'generated', 'python')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'bundle_rows.py'), out)
  return join(dir, 'bundle_rows.py')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitPythonTables())
