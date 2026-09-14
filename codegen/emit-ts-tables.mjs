// Emit generated/ts/bundleRows.ts — one interface per row-shaped table, in DDL column order.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, GENERATED_HEADER } from './lib/duck.mjs'
import { mapType, camel } from './lib/types.mjs'
import { tableRows } from './lib/tables.mjs'

export function emitTsTables() {
  const interfaces = tableRows()
    .map((t) => {
      const fields = t.fields
        .map((f) => {
          const ty = mapType(f.duckType).tsType
          return `  ${camel(f.column)}: ${f.optional ? `${ty} | null` : ty}`
        })
        .join('\n')
      return `/** One \`${t.table}\` row, in column order. */\nexport interface ${t.typeName} {\n${fields}\n}`
    })
    .join('\n\n')

  const out = GENERATED_HEADER('ts') + `\n${interfaces}\n`

  const dir = join(REPO, 'generated', 'ts')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'bundleRows.ts'), out)
  return join(dir, 'bundleRows.ts')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitTsTables())
