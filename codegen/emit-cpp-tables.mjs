// Emit generated/cpp/bundle_rows.h — one struct per row-shaped table, in DDL column
// order. Include-light (no arrow), like envelope_spec.h.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, GENERATED_HEADER } from './lib/duck.mjs'
import { mapType } from './lib/types.mjs'
import { tableRows } from './lib/tables.mjs'

export function emitCppTables() {
  const structs = tableRows()
    .map((t) => {
      const fields = t.fields
        .map((f) => {
          const ty = mapType(f.duckType).cppType
          return `  ${f.optional ? `std::optional<${ty}>` : ty} ${f.column};`
        })
        .join('\n')
      return `// One ${t.table} row, in column order.\nstruct ${t.typeName} {\n${fields}\n};`
    })
    .join('\n\n')

  const out =
    GENERATED_HEADER('cpp') +
    `#pragma once
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace bundlespec {

${structs}

}  // namespace bundlespec
`

  const dir = join(REPO, 'generated', 'cpp')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'bundle_rows.h'), out)
  return join(dir, 'bundle_rows.h')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitCppTables())
