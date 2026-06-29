// Regenerate every artifact from spec/bundle-spec.sql.
import { emitTs } from './emit-ts.mjs'
import { emitCpp } from './emit-cpp.mjs'
import { emitCsharp } from './emit-csharp.mjs'
import { emitDocs } from './emit-docs.mjs'

const steps = [
  ['TypeScript', emitTs],
  ['C++', emitCpp],
  ['C#', emitCsharp],
  ['docs', emitDocs]
]
for (const [label, fn] of steps) console.log(`  ${label.padEnd(11)} → ${fn()}`)
console.log('done.')
