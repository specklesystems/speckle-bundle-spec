// Spec invariants — run in CI on every spec edit. No bundle needed; these guard
// the spec itself (the rules a human might break while editing bundle-spec.sql).
import { relTypes, nodeKinds } from '../../codegen/lib/duck.mjs'

let fails = 0
const check = (cond, msg) => {
  if (!cond) {
    console.error(`  ✗ ${msg}`)
    fails++
  } else console.log(`  ✓ ${msg}`)
}

const rels = relTypes()
const kinds = nodeKinds()

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

// 6. emitted_by only references known producers.
const PRODUCERS = new Set(['rvextract', 'nwextract', 'managed', 'teklaextract'])
check(
  rels
    .filter((r) => r.emitted_by)
    .every((r) => r.emitted_by.split(',').every((p) => PRODUCERS.has(p.trim()))),
  'emitted_by references only known producers'
)

// 7. Assembly membership remains one output-neutral object axis. The main
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

console.log(fails === 0 ? '\nconformance: PASS' : `\nconformance: ${fails} FAILURE(S)`)
process.exit(fails === 0 ? 0 : 1)
