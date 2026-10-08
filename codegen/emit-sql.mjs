// Copy spec/bundle-spec.sql into packages/ts/spec/ byte-for-byte: the catalog package
// ships the executable spec, and the conformance validator reads it from there.
import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { OUT, SPEC } from './lib/duck.mjs'

export function emitSql() {
  mkdirSync(OUT.sql, { recursive: true })
  const out = join(OUT.sql, 'bundle-spec.sql')
  copyFileSync(SPEC, out)
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitSql())
