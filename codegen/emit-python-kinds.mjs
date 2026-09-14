// Emit generated/python/bundle_nodes.py — one frozen dataclass per live node kind.
// Mirrors BundleNodes.cs.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, GENERATED_HEADER } from './lib/duck.mjs'
import { mapType, kindTypeName } from './lib/types.mjs'
import { nodeKindFields } from './lib/kinds.mjs'

export function emitPythonKinds() {
  const classes = nodeKindFields()
    .map((k) => {
      // Optional fields carry a None default, so they must follow the mandatory ones.
      const ordered = [...k.fields].sort((a, b) => Number(a.optional) - Number(b.optional))
      const fields = ordered
        .map((f) => {
          const t = mapType(f.duckType).pyType
          return f.optional ? `    ${f.column}: Optional[${t}] = None` : `    ${f.column}: ${t}`
        })
        .join('\n')
      return (
        `@dataclass(frozen=True)\nclass ${kindTypeName(k.name)}:\n` +
        `    """${k.description}"""\n\n${fields}`
      )
    })
    .join('\n\n\n')

  const out =
    GENERATED_HEADER('py') +
    `"""One record per live node kind, carrying exactly the nodes.* columns it declares.

Single source of truth: speckle-bundle-spec/spec/bundle-spec.sql (node_kinds.columns).
"""

from dataclasses import dataclass
from typing import Optional


${classes}
`

  const dir = join(REPO, 'generated', 'python')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'bundle_nodes.py'), out)
  return join(dir, 'bundle_nodes.py')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitPythonKinds())
