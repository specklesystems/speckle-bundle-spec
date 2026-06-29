// Regenerate every artifact from spec/bundle-spec.sql.
import { emitTs } from './emit-ts.mjs'
import { emitCpp } from './emit-cpp.mjs'
import { emitCppSchemas } from './emit-cpp-schemas.mjs'
import { emitCsharp } from './emit-csharp.mjs'
import { emitCsharpSchemas } from './emit-csharp-schemas.mjs'
import { emitDocs } from './emit-docs.mjs'

const steps = [
  ['TypeScript', emitTs],
  ['C++ enums', emitCpp],
  ['C++ schemas', emitCppSchemas],
  ['C# enums', emitCsharp],
  ['C# schemas', emitCsharpSchemas],
  ['docs', emitDocs]
]
for (const [label, fn] of steps) console.log(`  ${label.padEnd(11)} → ${fn()}`)
console.log('done.')
