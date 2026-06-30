// Regenerate every artifact from spec/bundle-spec.sql.
import { emitTs } from './emit-ts.mjs'
import { emitCpp } from './emit-cpp.mjs'
import { emitCppSchemas } from './emit-cpp-schemas.mjs'
import { emitCsharp } from './emit-csharp.mjs'
import { emitCsharpSchemas } from './emit-csharp-schemas.mjs'
import { emitPython } from './emit-python.mjs'
import { emitPythonSchemas } from './emit-python-schemas.mjs'
import { emitDocs } from './emit-docs.mjs'

const steps = [
  ['TypeScript', emitTs],
  ['C++ enums', emitCpp],
  ['C++ schemas', emitCppSchemas],
  ['C# enums', emitCsharp],
  ['C# schemas', emitCsharpSchemas],
  ['Python enums', emitPython],
  ['Python schemas', emitPythonSchemas],
  ['docs', emitDocs]
]
for (const [label, fn] of steps) console.log(`  ${label.padEnd(11)} → ${fn()}`)
console.log('done.')
