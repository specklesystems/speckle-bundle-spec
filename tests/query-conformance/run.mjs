// Reference runner for conformance/query: mounts the committed synthetic bundle in the
// DuckDB CLI exactly as the contract prescribes, then asserts schema.json and every golden
// case. Runs under `npm test` so a spec or fixture edit that breaks a golden goes red HERE
// before any engine vendors it. Engines run the same suite via their own runner.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { REPO } from '../../codegen/lib/duck.mjs'
import {
  APPLICATION_ID_PATH,
  PATHS_RAW_VIEW,
  bundleMountExtraSql,
  compareResult,
  expandSql,
  loadSuite,
  mountPlan,
  rowsFromObjects
} from '../../conformance/query/harness.mjs'

const DUCKDB = process.env.DUCKDB_BIN || 'duckdb'
const suite = loadSuite(join(REPO, 'conformance', 'query'))
const { alias } = suite.schema
const q = (s) => s.replace(/'/g, "''")

let fails = 0
const check = (cond, msg) => {
  if (!cond) {
    console.error(`  ✗ ${msg}`)
    fails++
  } else console.log(`  ✓ ${msg}`)
}

// The mount: one schema per alias, one view per mountable file (the paths parquet under
// `paths_raw`), then the synthesized `paths` + `object_properties` views.
const plan = mountPlan(suite.files.map((f) => f.name))
const pathOf = Object.fromEntries(suite.files.map((f) => [f.name, f.path]))
const mountSql = [
  `CREATE SCHEMA "${alias}";`,
  ...plan.views.map(
    (v) => `CREATE VIEW "${alias}"."${v.view}" AS SELECT * FROM read_parquet('${q(pathOf[v.name])}');`
  ),
  ...bundleMountExtraSql(alias).map((sql) => sql + ';')
].join('\n')

// Every statement runs in a fresh CLI process with the mount replayed; the suite is small
// enough that this costs nothing and keeps each case independent.
function run(sql) {
  const out = execFileSync(DUCKDB, ['-json'], {
    input: `${mountSql}\n${sql};\n`,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim()
  return out ? JSON.parse(out) : []
}

console.log('schema identity')
check(
  JSON.stringify(plan.skipped) === JSON.stringify(suite.schema.notMounted),
  `never mounted: ${suite.schema.notMounted.join(', ')}`
)
const mounted = run(
  `SELECT table_name FROM information_schema.tables WHERE table_schema = '${alias}' ORDER BY table_name`
).map((r) => r.table_name)
const expectedViews = Object.keys(suite.schema.views).sort()
check(
  JSON.stringify(mounted) === JSON.stringify(expectedViews),
  `schema "${alias}" exposes exactly ${expectedViews.length} views` +
    (JSON.stringify(mounted) === JSON.stringify(expectedViews) ? '' : ` — got ${mounted.join(', ')}`)
)
for (const [view, cols] of Object.entries(suite.schema.views)) {
  const got = run(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = '${alias}' AND table_name = '${view}' ORDER BY ordinal_position`
  ).map((r) => r.column_name)
  check(JSON.stringify(got) === JSON.stringify(cols), `${alias}.${view} columns match the spec`)
}
const [{ n: opRows }] = run(`SELECT count(*) AS n FROM "${alias}"."object_properties"`)
check(
  Number(opRows) === suite.schema.objectPropertiesRowCount,
  `object_properties = eav ∪ type-resolved rows (${suite.schema.objectPropertiesRowCount})`
)
const [{ n: groups }] = run(
  `SELECT count(DISTINCT row_group_id) AS n FROM parquet_metadata('${q(pathOf[`${alias}.eav.eav.parquet`])}')`
)
check(Number(groups) === suite.schema.eavRowGroups, `eav parquet spans ${suite.schema.eavRowGroups} row groups`)
let geometryReachable = true
try {
  run(`SELECT count(*) FROM "${alias}"."geometries"`)
} catch {
  geometryReachable = false
}
check(!geometryReachable, `"${alias}"."geometries" does not exist (shards are never mounted)`)

// The virtual applicationId path is guarded on the producer not already emitting it —
// a branch the golden bundle (which has no such path) cannot exercise. Replay the mount
// over a `paths_raw` that DOES carry the path and assert both halves stay silent.
console.log('virtual path guard')
{
  const guarded = 'guarded'
  const rawWithPath =
    `CREATE SCHEMA "${guarded}";\n` +
    plan.views
      .filter((v) => v.view !== PATHS_RAW_VIEW)
      .map(
        (v) =>
          `CREATE VIEW "${guarded}"."${v.view}" AS SELECT * FROM read_parquet('${q(pathOf[v.name])}');`
      )
      .join('\n') +
    `\nCREATE VIEW "${guarded}"."${PATHS_RAW_VIEW}" AS ` +
    `SELECT * FROM read_parquet('${q(pathOf[`${alias}.eav.paths.parquet`])}') ` +
    `UNION ALL SELECT 33, '${APPLICATION_ID_PATH}';\n` +
    bundleMountExtraSql(guarded)
      .map((sql) => sql + ';')
      .join('\n')
  const runGuarded = (sql) => {
    const out = execFileSync(DUCKDB, ['-json'], {
      input: `${rawWithPath}\n${sql};\n`,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
    return out ? JSON.parse(out) : []
  }
  const rows = runGuarded(
    `SELECT path_index FROM "${guarded}"."paths" WHERE path = '${APPLICATION_ID_PATH}' ORDER BY path_index`
  ).map((r) => Number(r.path_index))
  check(
    JSON.stringify(rows) === JSON.stringify([33]),
    `a producer-emitted applicationId path is not doubled (got ${JSON.stringify(rows)})`
  )
  const [{ n: objectRows }] = run(`SELECT count(*) AS n FROM "${alias}"."objects"`)
  const [{ n }] = runGuarded(`SELECT count(*) AS n FROM "${guarded}"."object_properties"`)
  check(
    Number(n) === suite.schema.objectPropertiesRowCount - Number(objectRows),
    `object_properties drops the virtual arm when the path is real (${Number(n)})`
  )
}

console.log('golden cases')
for (const c of suite.cases) {
  const sql = expandSql(c.sql, { localDir: suite.localDir })
  let verdict
  try {
    const rowObjects = run(sql)
    const actual = { columns: c.expected.columns, rows: rowsFromObjects(c.expected.columns, rowObjects) }
    // The CLI's JSON output loses column order for empty results; column identity is
    // asserted through DESCRIBE instead.
    const described = run(`DESCRIBE ${sql}`).map((r) => r.column_name)
    verdict =
      JSON.stringify(described) !== JSON.stringify(c.expected.columns)
        ? `columns ${JSON.stringify(described)} ≠ ${JSON.stringify(c.expected.columns)}`
        : compareResult(actual, c.expected)
  } catch (e) {
    verdict = `threw: ${String(e.stderr ?? e.message).trim().split('\n')[0]}`
  }
  check(verdict === null, `${c.name}${verdict ? ` — ${verdict}` : ''}`)
}

console.log(fails === 0 ? '\nquery conformance: PASS' : `\nquery conformance: ${fails} FAILURE(S)`)
process.exit(fails === 0 ? 0 : 1)
