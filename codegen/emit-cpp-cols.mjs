// Emit generated/cpp/bundle_cols.h — NAMED column-index constants per produced
// table, so writers address Arrow builders/rows by name instead of hard-coded
// ordinals. A spec column INSERTION shifts these automatically; a rename/removal
// breaks the consumer's compile — either way the writer cannot silently drift
// from the schema it builds via bundle_schemas.h (the Jul-29 empty-nodes
// incident: elevation written at a stale ordinal after emissive/ior landed).
// Include-light on purpose (no arrow) — usable by any translation unit.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, GENERATED_HEADER, tableColumns } from './lib/duck.mjs'
import { snake } from './lib/types.mjs'

export function emitCppCols() {
  const cols = tableColumns()
  const byTable = {}
  for (const c of cols) (byTable[c.table_name] ??= []).push(c)

  const blocks = Object.entries(byTable)
    .map(([table, cs]) => {
      const consts = cs
        .map((c, i) => `inline constexpr int ${snake(c.column_name)} = ${i};`)
        .join('\n')
      const ns = `bundlespec::col::${snake(table)}`
      return (
        `namespace ${ns} {\n` +
        `${consts}\n` +
        `inline constexpr int columnCount = ${cs.length};\n` +
        `}  // namespace ${ns}`
      )
    })
    .join('\n\n')

  const out =
    GENERATED_HEADER('cpp') +
    `#pragma once

// Column index of every produced table's parquet field, in spec order (matches
// bundle_schemas.h field order 1:1). NOTE: camera_views has columns named
// \`near\`/\`far\` — on Windows include this header BEFORE <windows.h> or compile
// with WIN32_LEAN_AND_MEAN/#undef near,far (windef.h defines them as macros).

${blocks}
`

  const dir = join(REPO, 'generated', 'cpp')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'bundle_cols.h'), out)
  return join(dir, 'bundle_cols.h')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitCppCols())
