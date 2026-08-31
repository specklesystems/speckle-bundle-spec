// Build the query-conformance synthetic bundle: run the spec DDL + conformance/query/
// fixture.sql in DuckDB, COPY every bundle_files table to its spec-named parquet, and
// emit schema.json (the mounted-schema expectation, derived from the spec so the spec
// stays the only hand-authored source of column truth).
//
//   node codegen/build-query-fixture.mjs      # → conformance/query/bundle/, schema.json
//
// The parquet bytes are committed (consumers vendor the directory); this script is the
// reproducible recipe, not a CI check — DuckDB writer versions differ in parquet metadata,
// so byte-identity across machines is not a goal. Row content is deterministic.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, SPEC, bundleFiles, tableColumns } from './lib/duck.mjs'
import { PATHS_RAW_VIEW } from '../conformance/query/harness.mjs'

const DUCKDB = process.env.DUCKDB_BIN || 'duckdb'
const SUITE = join(REPO, 'conformance', 'query')
const BUNDLE_DIR = join(SUITE, 'bundle')
const BASE = 'gold'
const ALIAS = 'gold'
// DuckDB rounds ROW_GROUP_SIZE to a multiple of its 2048-row vector; 6000 eav rows → 3 groups.
const EAV_ROW_GROUP_SIZE = 2048
// geometries is the only sharded table: shard 0 keeps the canonical name, overflow is `.1`.
const GEOMETRY_SHARD_SPLIT = 6

const fixtureSql = readFileSync(join(SUITE, 'fixture.sql'), 'utf8')
const files = bundleFiles()
const fileName = (logical) => files.find((f) => f.name === logical).file_pattern.replace('{base}', BASE)

rmSync(BUNDLE_DIR, { recursive: true, force: true })
mkdirSync(BUNDLE_DIR, { recursive: true })

const copies = []
for (const f of files) {
  const target = join(BUNDLE_DIR, fileName(f.name))
  if (f.name === 'geometries') {
    copies.push(
      `COPY (SELECT * FROM geometries WHERE geometryIndex < ${GEOMETRY_SHARD_SPLIT} ORDER BY geometryIndex) TO '${target}' (FORMAT PARQUET);`,
      `COPY (SELECT * FROM geometries WHERE geometryIndex >= ${GEOMETRY_SHARD_SPLIT} ORDER BY geometryIndex) TO '${target.replace(/\.parquet$/, '.1.parquet')}' (FORMAT PARQUET);`
    )
    continue
  }
  const rowGroup = f.name === 'eav' ? `, ROW_GROUP_SIZE ${EAV_ROW_GROUP_SIZE}` : ''
  const order = f.name === 'eav' ? ' ORDER BY object_index, path_index' : ''
  copies.push(`COPY (SELECT * FROM ${f.name}${order}) TO '${target}' (FORMAT PARQUET${rowGroup});`)
}

execFileSync(DUCKDB, [], {
  input: readFileSync(SPEC, 'utf8') + '\n' + fixtureSql + '\n' + copies.join('\n') + '\n',
  stdio: ['pipe', 'inherit', 'inherit']
})

// Sanity: the fixture must pass the spec's own validator (it is a real bundle).
execFileSync(process.execPath, [join(REPO, 'validator', 'validate-bundle.mjs'), BUNDLE_DIR], {
  stdio: 'inherit'
})

// schema.json — the mounted-schema expectation every engine asserts against.
const written = readdirSync(BUNDLE_DIR).sort()
const byTable = {}
for (const c of tableColumns()) (byTable[c.table_name] ??= []).push(c.column_name)
// catalogs are excluded from tableColumns(); their columns come from the spec DDL too.
const catalogCols = (table) =>
  execCols(`SELECT column_name FROM duckdb_columns() WHERE table_name = '${table}' ORDER BY column_index`)
function execCols(sql) {
  const out = execFileSync(DUCKDB, ['-json'], {
    input: readFileSync(SPEC, 'utf8') + '\n' + sql + '\n',
    encoding: 'utf8'
  })
  return JSON.parse(out).map((r) => r.column_name)
}
const views = {}
for (const f of files) {
  if (f.sharded) continue
  // The paths parquet mounts under `paths_raw`; the public `paths` name is the
  // synthesized view (raw dictionary ∪ the virtual applicationId row), same columns.
  views[f.name === 'paths' ? PATHS_RAW_VIEW : f.name] = byTable[f.name] ?? catalogCols(f.name)
}
views.paths = byTable.paths
views.object_properties = [
  'object_index',
  'path_index',
  'value_string',
  'value_double',
  'value_boolean',
  'unit',
  'internal_definition_name'
]
const notMounted = written.filter((n) => /\.geometries(?:\.\d+)?\.parquet$/.test(n))
const eavRows = 6000
const typedRows = 199 * 3
// The virtual applicationId arm: one row per object, since the fixture's path dictionary
// does not carry `applicationId` itself (so the mount's guard leaves the arm live).
const objectRows = 200
const schema = {
  alias: ALIAS,
  files: written,
  views,
  notMounted,
  objectPropertiesRowCount: eavRows + typedRows + objectRows,
  eavRowGroups: 3
}
writeFileSync(join(SUITE, 'schema.json'), JSON.stringify(schema, null, 2) + '\n')

const sizeKb = written.reduce((s, n) => s + readFileSync(join(BUNDLE_DIR, n)).length, 0) / 1024
console.log(`query fixture → conformance/query/bundle/ (${written.length} files, ${sizeKb.toFixed(0)} KB), schema.json`)
