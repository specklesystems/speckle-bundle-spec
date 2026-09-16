// Emit generated/csharp/BundleNodes.cs — one record per live node kind, carrying
// exactly the columns that kind declares. Writers construct one instead of passing
// loose scalars; readers project a nodes row into one and reject a NULL in a
// mandatory slot. Positional records only: init-only setters break net48 consumers
// of the ILRepack'd netstandard2.0 assembly (CS0570).
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, GENERATED_HEADER } from './lib/duck.mjs'
import { mapType, pascal, kindTypeName } from './lib/types.mjs'
import { nodeKindFields } from './lib/kinds.mjs'

const clr = (f) => {
  const t = mapType(f.duckType).clr
  return f.optional ? `${t}?` : t
}

export function emitCsharpKinds() {
  const records = nodeKindFields()
    .map((k) => {
      const params = k.fields.map((f) => `${clr(f)} ${pascal(f.column)}`).join(', ')
      const cols = k.fields.map((f) => f.column + (f.optional ? '?' : '')).join('</c>, <c>')
      return (
        `/// <summary>${k.description} Columns: <c>${cols}</c>.</summary>\n` +
        `public sealed record ${kindTypeName(k.name)}(${params});`
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
  writeFileSync(join(dir, 'BundleNodes.cs'), out)
  return join(dir, 'BundleNodes.cs')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitCsharpKinds())
