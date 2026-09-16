// Emit generated/ts/bundleNodes.ts — one type alias per live node kind, so the
// viewer/server type a projected nodes row instead of reading loose columns.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, GENERATED_HEADER } from './lib/duck.mjs'
import { mapType, camel, kindTypeName } from './lib/types.mjs'
import { nodeKindFields } from './lib/kinds.mjs'

export function emitTsKinds() {
  const types = nodeKindFields()
    .map((k) => {
      const fields = k.fields
        .map((f) => {
          const t = mapType(f.duckType).tsType
          return `  ${camel(f.column)}: ${f.optional ? `${t} | null` : t}`
        })
        .join('\n')
      return `/** ${k.description} */\nexport type ${kindTypeName(k.name)} = {\n${fields}\n}`
    })
    .join('\n\n')

  const out = GENERATED_HEADER('ts') + `\n${types}\n`

  const dir = join(REPO, 'generated', 'ts')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'bundleNodes.ts'), out)
  return join(dir, 'bundleNodes.ts')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitTsKinds())
