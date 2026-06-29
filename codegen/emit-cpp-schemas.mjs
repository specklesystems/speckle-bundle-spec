// Emit generated/cpp/bundle_schemas.h — one arrow::Schema factory per produced
// table, so bundle_writer.h builds its parquet schemas FROM the spec instead of
// hand-declaring them. Arrow-dependent, so kept out of envelope_spec.h (which
// stays include-light for pure enum consumers).
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, GENERATED_HEADER, tableColumns } from './lib/duck.mjs'
import { mapType, camel } from './lib/types.mjs'

export function emitCppSchemas() {
  const cols = tableColumns()
  const byTable = {}
  for (const c of cols) (byTable[c.table_name] ??= []).push(c)

  const fns = Object.entries(byTable)
    .map(([table, cs]) => {
      const fields = cs
        .map((c) => `      arrow::field("${c.column_name}", ${mapType(c.data_type).arrowCpp})`)
        .join(',\n')
      return (
        `// ${table}\n` +
        `inline std::shared_ptr<arrow::Schema> ${camel(table)}Schema() {\n` +
        `  return arrow::schema({\n${fields}\n  });\n}`
      )
    })
    .join('\n\n')

  const out =
    GENERATED_HEADER('cpp') +
    `#pragma once
#include <arrow/api.h>
#include <memory>

// Field nullability is left at Arrow's default (nullable); the spec's NOT NULL
// markers are validation intent, not parquet constraints.
namespace bundlespec {

${fns}

}  // namespace bundlespec
`

  const dir = join(REPO, 'generated', 'cpp')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'bundle_schemas.h'), out)
  return join(dir, 'bundle_schemas.h')
}

if (import.meta.url === `file://${process.argv[1]}`)
  console.log('wrote', emitCppSchemas())
