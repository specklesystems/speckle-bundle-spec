// Regenerate every artifact from spec/bundle-spec.sql.
import { emitTs } from './emit-ts.mjs'
import { emitTsKinds } from './emit-ts-kinds.mjs'
import { emitCpp } from './emit-cpp.mjs'
import { emitCppSchemas } from './emit-cpp-schemas.mjs'
import { emitCppCols } from './emit-cpp-cols.mjs'
import { emitCppKinds } from './emit-cpp-kinds.mjs'
import { emitCsharp } from './emit-csharp.mjs'
import { emitCsharpSchemas } from './emit-csharp-schemas.mjs'
import { emitCsharpCols } from './emit-csharp-cols.mjs'
import { emitCsharpKinds } from './emit-csharp-kinds.mjs'
import { emitPython } from './emit-python.mjs'
import { emitPythonSchemas } from './emit-python-schemas.mjs'
import { emitPythonCols } from './emit-python-cols.mjs'
import { emitPythonKinds } from './emit-python-kinds.mjs'
import { emitDocs } from './emit-docs.mjs'

const steps = [
  ['TypeScript', emitTs],
  ['TS nodes', emitTsKinds],
  ['C++ enums', emitCpp],
  ['C++ schemas', emitCppSchemas],
  ['C++ cols', emitCppCols],
  ['C++ nodes', emitCppKinds],
  ['C# enums', emitCsharp],
  ['C# schemas', emitCsharpSchemas],
  ['C# cols', emitCsharpCols],
  ['C# nodes', emitCsharpKinds],
  ['Python enums', emitPython],
  ['Python schemas', emitPythonSchemas],
  ['Python cols', emitPythonCols],
  ['Python nodes', emitPythonKinds],
  ['docs', emitDocs]
]
for (const [label, fn] of steps) console.log(`  ${label.padEnd(11)} → ${fn()}`)
console.log('done.')
