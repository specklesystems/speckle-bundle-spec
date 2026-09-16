// Spec invariants — run in CI on every spec edit. No bundle needed; these guard
// the spec itself (the rules a human might break while editing bundle-spec.sql).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  REPO,
  relTypes,
  nodeKinds,
  query,
  schemaVersion,
  SEMVER_RE
} from '../../codegen/lib/duck.mjs'

let fails = 0
const check = (cond, msg) => {
  if (!cond) {
    console.error(`  ✗ ${msg}`)
    fails++
  } else console.log(`  ✓ ${msg}`)
}

const rels = relTypes()
const kinds = nodeKinds()

// These names are the physical parquet contract used by deployed producers and
// consumers. Code generation aliases them to the generic `id` API below.
const catalogColumns = (table) =>
  query(
    `SELECT column_name FROM duckdb_columns()
     WHERE schema_name = 'main' AND table_name = '${table}'
     ORDER BY column_index`
  ).map((r) => r.column_name)
check(catalogColumns('rel_types')[0] === 'rel', 'rel_types primary key is the deployed rel column')
check(catalogColumns('node_kinds')[0] === 'kind', 'node_kinds primary key is the deployed kind column')

// 'geometry|instance' entered the vocabulary with the HAS_MATERIAL src broadening
// (ENG-8849): placement-painted materials make the src a geometry K or an INSTANCE node K.
const NS = new Set(['object', 'node', 'geometry', 'geometry|object', 'geometry|instance'])
const ORD = new Set(['ordinal', 'scope', null])
const STATUS = new Set(['live', 'reserved', 'retired'])

// 1. ids unique (the "retire in place, never reuse" rule manifests as: one row per id).
const relIds = rels.map((r) => r.id)
check(new Set(relIds).size === relIds.length, 'rel ids are unique (retired ids never reused)')
const kindIds = kinds.map((k) => k.id)
check(new Set(kindIds).size === kindIds.length, 'node-kind ids are unique')

// 2. statuses valid.
check(rels.every((r) => STATUS.has(r.status)), 'every rel status ∈ {live,reserved,retired}')
check(kinds.every((k) => STATUS.has(k.status)), 'every node-kind status ∈ {live,reserved,retired}')

// 3. live rels are fully specified; retired rels are blanked.
check(
  rels.filter((r) => r.status === 'live').every((r) => NS.has(r.src_ns) && NS.has(r.dst_ns)),
  'live rels have valid src_ns/dst_ns'
)
check(
  rels.filter((r) => r.status === 'retired').every((r) => r.src_ns == null && r.dst_ns == null),
  'retired rels carry no namespaces'
)
check(rels.every((r) => ORD.has(r.ord_semantics)), 'every ord_semantics ∈ {ordinal,scope,null}')

// 4. every live/reserved rel & kind documents itself.
check(
  rels.filter((r) => r.status !== 'retired').every((r) => r.description && r.why),
  'live/reserved rels have description + why'
)

// 5. CONTAINER (the one polymorphic kind) declares its subtype set.
const container = kinds.find((k) => k.name === 'CONTAINER')
check(container?.subtype_values?.split(',').length >= 2, 'CONTAINER declares ≥2 subtype values')

// 6. Every live kind's declared column set is real: codegen builds the per-kind
// node records from it, so a typo must break the build, not emit a wrong field.
const nodeColumns = new Set(
  query(
    `SELECT column_name FROM duckdb_columns()
     WHERE schema_name = 'main' AND table_name = 'nodes'`
  ).map((r) => r.column_name)
)
const declared = kinds
  .filter((k) => k.status === 'live')
  .map((k) => ({
    name: k.name,
    cols: (k.columns ?? '')
      .split(',')
      .map((s) => s.trim().replace(/\?$/, ''))
      .filter(Boolean)
  }))
check(declared.every((k) => k.cols.length > 0), 'every live node kind declares >=1 column')
const unknown = declared.flatMap((k) =>
  k.cols.filter((c) => !nodeColumns.has(c)).map((c) => `${k.name}.${c}`)
)
check(unknown.length === 0, `node_kinds.columns names only real nodes columns${unknown.length ? ` (${unknown.join(', ')})` : ''}`)

// 7. Every table the row-record emitter names is real: codegen builds a caller-facing
// record from its columns, so a renamed or dropped table must break the build.
const rowTables = ['structural_results', 'property_set_definitions', 'camera_views'];
const missingTables = rowTables.filter((t) => catalogColumns(t).length === 0);
check(
  missingTables.length === 0,
  `row-record tables all exist in the DDL${missingTables.length ? ` (missing: ${missingTables.join(', ')})` : ''}`
);

// 8. emitted_by only references known producers.
const PRODUCERS = new Set([
  'rvextract',
  'nwextract',
  'dwgextract',
  'dgnextract',
  'skpextract',
  'teklaextract',
  'managed'
])
check(
  rels
    .filter((r) => r.emitted_by)
    .every((r) => r.emitted_by.split(',').every((p) => PRODUCERS.has(p.trim()))),
  'emitted_by references only known producers'
)

// 9. Assembly membership remains one output-neutral object axis. The main
// member is ordinal zero; nested assemblies use the same relation rather than
// reviving the redundant IN_SUBASSEMBLY vocabulary.
const inAssembly = rels.find((r) => r.id === 18)
check(
  inAssembly?.name === 'IN_ASSEMBLY' &&
    inAssembly.status === 'live' &&
    inAssembly.src_ns === 'object' &&
    inAssembly.dst_ns === 'object' &&
    inAssembly.ord_semantics === 'ordinal',
  'IN_ASSEMBLY is live object→object ordinal membership'
)
check(
  rels.find((r) => r.id === 19)?.status === 'retired',
  'IN_SUBASSEMBLY remains retired'
)

// 10. meta.schema_version is the spec's semver string and names the package release:
// one value, not two numbers kept in step by hand (VERSIONING.md).
const sv = schemaVersion()
check(typeof sv === 'string' && SEMVER_RE.test(sv), `meta.schema_version is a semver string (${sv})`)
const pkgVersion = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).version
check(sv === pkgVersion, `meta.schema_version equals package.json version (${pkgVersion})`)

console.log(fails === 0 ? '\nconformance: PASS' : `\nconformance: ${fails} FAILURE(S)`)
process.exit(fails === 0 ? 0 : 1)
