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

// 6. cross-table referential integrity: every relation endpoint whose namespace
// (per the rel_types catalog) is `node` must resolve to an existing nodes.id.
// THE incident shape this guards (Jul 2025, empty-nodes fleet-wide): a producer
// uploads a valid-but-EMPTY nodes parquet while relations still reference node
// endpoints — every placement edge dangles and the viewer builds 0 placements.
// Empty-nodes-with-node-refs and any individually dangling endpoint both fail
// HERE, in producer CI, instead of rendering an invisible model. Mixed
// namespaces (`geometry|instance`) are ambiguous by design and are not checked.
if (present('relations') && present('nodes')) {
  const catalog = new Map(relTypes().map((r) => [r.id, r]))
  const nodeEndpoints = usedRels.flatMap((id) => {
    const r = catalog.get(id)
    return ['src', 'dst']
      .filter((c) => r?.[`${c}_ns`] === 'node')
      .map((c) => ({ id, name: r.name, col: c }))
  })
  const nodeCount = Number(
    query(`SELECT count(*) AS n FROM ${pq('nodes')}`, { withSpec: false })[0].n
  )
  if (nodeEndpoints.length)
    check(
      nodeCount > 0,
      `nodes non-empty while relations reference node endpoints (${[...new Set(nodeEndpoints.map((e) => e.name))].join(', ')})`
    )
  for (const { id, name, col } of nodeEndpoints) {
    const [r] = query(
      `SELECT count(*) AS total, count(*) FILTER (WHERE n.id IS NULL) AS dangling
       FROM ${pq('relations')} r LEFT JOIN ${pq('nodes')} n ON r.${col} = n.id
       WHERE r.rel = ${id}`,
      { withSpec: false }
    )
    check(
      Number(r.dangling) === 0,
      `${name}(${id}).${col} → node endpoints resolve to nodes.id` +
        (Number(r.dangling) ? ` — ${r.dangling}/${r.total} dangling (nodes rows=${nodeCount})` : '')
    )
  }
}

// 7. member/association invariants (PLACES 24 / DEFINES_MEMBER 25). These rels are
// additive — every check below is vacuous on a bundle that doesn't emit them — but
// where they appear their contracts are load-bearing and fail silently downstream:
// a member object that also carries a top-level render edge bakes TWICE (once
// untransformed at the origin — the ENG-8782 shape the vocabulary exists to
// prevent), and a DEFINES_MEMBER row with neither DEFINES rows on (definition, ord)
// nor a PLACES placement is a member no consumer can reach (its layer and
// properties silently vanish from rebuilt definitions).
if (present('relations')) {
  const relByName = new Map(relTypes().map((r) => [r.name, r.id]))
  const PLACES = relByName.get('PLACES')
  const DEFINES_MEMBER = relByName.get('DEFINES_MEMBER')
  const DEFINES = relByName.get('DEFINES')
  const renderRoots = ['DISPLAY', 'SOLID', 'DISPLAY_INSTANCE'].map((n) => relByName.get(n))
  const R = pq('relations')

  if (usedRels.includes(PLACES) && present('nodes')) {
    const [r] = query(
      `SELECT count(*) AS total, count(*) FILTER (WHERE n.kind IS DISTINCT FROM 2) AS bad
       FROM ${R} r LEFT JOIN ${pq('nodes')} n ON r.dst = n.id WHERE r.rel = ${PLACES}`,
      { withSpec: false }
    )
    check(
      Number(r.bad) === 0,
      `PLACES(${PLACES}).dst → every target is an INSTANCE node` +
        (Number(r.bad) ? ` — ${r.bad}/${r.total} target a non-INSTANCE kind` : '')
    )
  }

  if (usedRels.includes(DEFINES_MEMBER)) {
    const [b] = query(
      `SELECT count(DISTINCT m.dst) AS bad FROM ${R} m
       JOIN ${R} r ON r.src = m.dst AND r.rel IN (${renderRoots.join(', ')})
       WHERE m.rel = ${DEFINES_MEMBER}`,
      { withSpec: false }
    )
    check(
      Number(b.bad) === 0,
      `DEFINES_MEMBER(${DEFINES_MEMBER}) members carry no top-level render edge (DISPLAY/SOLID/DISPLAY_INSTANCE)` +
        (Number(b.bad) ? ` — ${b.bad} member object(s) would bake twice` : '')
    )
    const [u] = query(
      `SELECT count(*) AS bad FROM ${R} m WHERE m.rel = ${DEFINES_MEMBER}
       AND NOT EXISTS (SELECT 1 FROM ${R} g WHERE g.rel = ${DEFINES} AND g.src = m.src AND g.ord = m.ord)
       AND NOT EXISTS (SELECT 1 FROM ${R} p WHERE p.rel = ${PLACES} AND p.src = m.dst)`,
      { withSpec: false }
    )
    check(
      Number(u.bad) === 0,
      `DEFINES_MEMBER(${DEFINES_MEMBER}) members resolve — DEFINES on (definition, ord) or a PLACES placement` +
        (Number(u.bad) ? ` — ${u.bad} unreachable member(s)` : '')
    )
  }
}

// 8. container appearance invariants (NODE_HAS_MATERIAL 28 / NODE_HAS_COLOR 29).
// Additive like section 7 — vacuous when unemitted. Both are node→node, so the
// generic endpoint checks can't type them: a NODE_HAS_MATERIAL pointing at a COLOR
// node (or vice versa) resolves silently to a null appearance on every consumer.
if (present('relations') && present('nodes')) {
  const relByName = new Map(relTypes().map((r) => [r.name, r.id]))
  const R = pq('relations')
  for (const [name, kind, kindName] of [
    ['NODE_HAS_MATERIAL', 3, 'MATERIAL'],
    ['NODE_HAS_COLOR', 4, 'COLOR'],
  ]) {
    const rel = relByName.get(name)
    if (!usedRels.includes(rel)) continue
    const [r] = query(
      `SELECT count(*) AS total, count(*) FILTER (WHERE n.kind IS DISTINCT FROM ${kind}) AS bad
       FROM ${R} r LEFT JOIN ${pq('nodes')} n ON r.dst = n.id WHERE r.rel = ${rel}`,
      { withSpec: false }
    )
    check(
      Number(r.bad) === 0,
      `${name}(${rel}).dst → every target is a ${kindName} node` +
        (Number(r.bad) ? ` — ${r.bad}/${r.total} target a non-${kindName} kind` : '')
    )
  }
}

console.log(fails === 0 ? '\nvalidate: PASS' : `\nvalidate: ${fails} FAILURE(S)`)
process.exit(fails === 0 ? 0 : 1)
