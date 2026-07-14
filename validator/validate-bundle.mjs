// Validate a real bundle against the spec. Usage:
//   node validator/validate-bundle.mjs <bundle-dir> [base]
// Attaches the bundle's parquets and checks: required files present, node.kind
// and relation.rel values are known (not retired), and the nodes table carries
// the spec's columns. Run this in each PRODUCER's CI against a freshly emitted
// bundle → a producer cannot drift from the spec without going red.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { query, relTypes, nodeKinds, bundleFiles, tableColumns } from '../codegen/lib/duck.mjs'

const dir = process.argv[2]
if (!dir) {
  console.error('usage: validate-bundle.mjs <bundle-dir> [base]')
  process.exit(2)
}
const files = readdirSync(dir)
// Detect base from `<base>.envelope.meta.parquet`.
let base = process.argv[3]
if (!base) {
  const m = files.find((f) => f.endsWith('.envelope.meta.parquet'))
  if (!m) {
    console.error('no *.envelope.meta.parquet in', dir)
    process.exit(2)
  }
  base = m.slice(0, -'.envelope.meta.parquet'.length)
}

const specFiles = bundleFiles()
const spec = (logical) => specFiles.find((f) => f.name === logical)
// Presence: the canonical/shard-0 file is always present if the table is.
const present = (logical) =>
  files.includes(spec(logical).file_pattern.replace('{base}', base).split('/').pop())
// Reads use the glob (covers sharded tables like geometries).
const pq = (logical) =>
  `read_parquet('${join(dir, spec(logical).file_glob.replace('{base}', base)).replace(/'/g, "''")}')`

let fails = 0
const check = (cond, msg) => {
  if (!cond) { console.error(`  ✗ ${msg}`); fails++ } else console.log(`  ✓ ${msg}`)
}

// 1. required files present.
for (const f of specFiles.filter((f) => f.required))
  check(present(f.name), `required file present: ${f.name}`)

// 2. relation.rel values are all live/reserved (never retired/unknown).
const knownRel = new Map(relTypes().map((r) => [r.id, r.status]))
const usedRels = present('relations')
  ? query(`SELECT DISTINCT rel FROM ${pq('relations')}`, { withSpec: false }).map((r) => r.rel)
  : []
for (const rel of usedRels) {
  const st = knownRel.get(rel)
  check(st === 'live' || st === 'reserved', `relation rel=${rel} is known & not retired (status=${st ?? 'UNKNOWN'})`)
}

// 3. node.kind values are all live.
const knownKind = new Map(nodeKinds().map((k) => [k.id, k.status]))
const usedKinds = present('nodes')
  ? query(`SELECT DISTINCT kind FROM ${pq('nodes')}`, { withSpec: false }).map((r) => r.kind)
  : []
for (const k of usedKinds) {
  const st = knownKind.get(k)
  check(st === 'live', `node kind=${k} is known & live (status=${st ?? 'UNKNOWN'})`)
}

// 4. every produced table carries the spec's columns (validates the generated schemas).
const byTable = {}
for (const c of tableColumns()) (byTable[c.table_name] ??= []).push(c.column_name)
for (const [table, specCols] of Object.entries(byTable)) {
  if (!present(table)) continue
  const cols = new Set(
    query(`DESCRIBE SELECT * FROM ${pq(table)}`, { withSpec: false }).map((d) => d.column_name)
  )
  const missing = specCols.filter((c) => !cols.has(c))
  check(missing.length === 0, `${table}: all spec columns present${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`)
}

// 5. K-space columns are dense, contiguous and unique (exactly {0..N-1}). Each spec
// comment already calls these "Dense int K"; this enforces it. The renderer's .dat
// builder sizes typed arrays to max(K)+1 and indexes positionally by K, so a gap or
// a duplicate is not cosmetic drift — it OOMs or corrupts the build. A parallel
// producer that mis-numbers a shard (or a merge that double-mints) fails HERE,
// loudly, instead of at GPU-buffer allocation in a consumer. geometries is sharded,
// so pq() reads the glob and the check spans all shards. Empty table = vacuously dense.
const kSpaces = [
  { table: 'objects', col: 'object_index' },
  { table: 'nodes', col: 'id' },
  { table: 'geometries', col: 'geometryIndex' }
]
for (const { table, col } of kSpaces) {
  if (!present(table)) continue
  const [r] = query(
    `SELECT count(*) AS n, count(DISTINCT "${col}") AS d,
            min("${col}") AS lo, max("${col}") AS hi FROM ${pq(table)}`,
    { withSpec: false }
  )
  const n = Number(r.n)
  const dense = n === 0 || (Number(r.d) === n && Number(r.lo) === 0 && Number(r.hi) === n - 1)
  check(
    dense,
    `${table}.${col}: dense contiguous K-space (0..N-1, unique)` +
      (dense ? '' : ` — count=${r.n} distinct=${r.d} min=${r.lo} max=${r.hi} (expected 0..${n - 1})`)
  )
}

console.log(fails === 0 ? '\nvalidate: PASS' : `\nvalidate: ${fails} FAILURE(S)`)
process.exit(fails === 0 ? 0 : 1)
