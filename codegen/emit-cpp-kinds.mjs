// Emit generated/cpp/bundle_nodes.h — one struct per live node kind. Optional
// fields are std::optional so a producer cannot leave a mandatory one unset by
// accident. Include-light (no arrow), like envelope_spec.h.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, GENERATED_HEADER } from './lib/duck.mjs'
import { mapType, kindTypeName } from './lib/types.mjs'
import { nodeKindFields } from './lib/kinds.mjs'

export function emitCppKinds() {
  const structs = nodeKindFields()
    .map((k) => {
      const fields = k.fields
        .map((f) => {
          const t = mapType(f.duckType).cppType
          return `  ${f.optional ? `std::optional<${t}>` : t} ${f.column};`
        })
        .join('\n')
      return `// ${k.description}\nstruct ${kindTypeName(k.name)} {\n${fields}\n};`
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
  writeFileSync(join(dir, 'bundle_nodes.h'), out)
  return join(dir, 'bundle_nodes.h')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitCppKinds())
