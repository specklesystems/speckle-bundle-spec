// verify-pin — the enforcement half of publish-and-pin. Checks that a consumer's
// copy of a bundle-spec target matches the published lockfile, so the native C++
// extractors and specklepy can't silently drift from the pinned spec version.
//
//   node codegen/verify-pin.mjs --cpp    <dir>   # <dir> exposes generated/cpp/*.h
//   node codegen/verify-pin.mjs --python <dir>   # <dir> holds the vendored *.py
//   node codegen/verify-pin.mjs --query-conformance <dir>   # <dir> is a vendored conformance/query/
//   node codegen/verify-pin.mjs --lock <path>    # override lockfile (default dist/bundle-spec.lock.json)
//
// Exits non-zero on any missing/mismatched file → drop-in CI drift guard. Only files
// the lock lists AND that exist in <dir> are compared (publish-synthesized wrappers
// like __init__.py / _version.py are absent from a raw vendored copy — that's fine;
// the point is that every file a consumer DOES ship is byte-identical to the pin).

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (flag) => {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}
const target = args.includes('--cpp')
  ? 'cpp'
  : args.includes('--python')
    ? 'python'
    : args.includes('--query-conformance')
      ? 'queryConformance'
      : undefined
const dir = opt('--cpp') || opt('--python') || opt('--query-conformance')
const lockPath = opt('--lock') || join(REPO, 'dist', 'bundle-spec.lock.json')

if (!target || !dir) {
  console.error(
    'usage: verify-pin.mjs (--cpp <dir> | --python <dir> | --query-conformance <dir>) [--lock <path>]'
  )
  process.exit(2)
}
if (!existsSync(lockPath)) {
  console.error(`lockfile not found: ${lockPath} — run \`npm run publish:artifacts\` first`)
  process.exit(2)
}

const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
const sha256 = (p) => 'sha256:' + createHash('sha256').update(readFileSync(p)).digest('hex')
const files = lock.targets[target].files // { "generated/cpp/foo.h": "sha256:..", ... }

let checked = 0
let mismatched = 0
let missing = 0
for (const [lockRel, want] of Object.entries(files)) {
  // lock keys mirror the consumer's natural layout (cpp: generated/cpp/x.h; python:
  // flat basename); also accept the file directly under <dir> as a fallback.
  const candidates = [join(dir, lockRel), join(dir, basename(lockRel))]
  const path = candidates.find(existsSync)
  if (!path) {
    console.error(`  MISSING   ${lockRel}`)
    missing++
    continue
  }
  const got = sha256(path)
  if (got === want) {
    checked++
  } else {
    console.error(`  MISMATCH  ${lockRel}\n              want ${want}\n              got  ${got}`)
    mismatched++
  }
}

const label = `${target} @ ${dir}`
if (mismatched || missing) {
  console.error(
    `\n✗ pin FAILED for ${label} (spec ${lock.name}@${lock.version}, schema_version ${lock.schemaVersion}): ` +
      `${mismatched} mismatched, ${missing} missing, ${checked} ok`
  )
  process.exit(1)
}
console.log(`✓ pin OK for ${label}: ${checked} files match ${lock.name}@${lock.version} (schema_version ${lock.schemaVersion})`)
