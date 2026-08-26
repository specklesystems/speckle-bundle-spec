// Emit generated/ts/bundleSpec.ts — enums + metadata the viewer & server import
// instead of hardcoding rel/kind ids and column names.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  REPO,
  GENERATED_HEADER,
  relTypes,
  nodeKinds,
  tableColumns,
  schemaVersion
} from './lib/duck.mjs'

const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "\\'")}'`)

export function emitTs() {
  const rels = relTypes()
  const kinds = nodeKinds()
  const cols = tableColumns()

  const live = (rows) => rows.filter((r) => r.status !== 'retired')

  const relEnum = live(rels)
    .map((r) => `  ${r.name}: ${r.id},`)
    .join('\n')
  const kindEnum = live(kinds)
    .map((k) => `  ${k.name}: ${k.id},`)
    .join('\n')

  const relMeta = rels
    .map(
      (r) =>
        `  { id: ${r.id}, name: ${q(r.name)}, srcNs: ${q(r.src_ns)}, dstNs: ${q(
          r.dst_ns
        )}, status: ${q(r.status)}, ordSemantics: ${q(r.ord_semantics)} },`
    )
    .join('\n')

  // table -> [columns]
  const byTable = {}
  for (const c of cols) (byTable[c.table_name] ??= []).push(c.column_name)
  const tables = Object.entries(byTable)
    .map(([t, cs]) => `  ${t}: [${cs.map(q).join(', ')}],`)
    .join('\n')

  const out =
    GENERATED_HEADER('ts') +
    `\nexport const SCHEMA_VERSION = '${schemaVersion()}' as const\n\n` +
    `/** Live relation ids. */\nexport const Rel = {\n${relEnum}\n} as const\n` +
    `export type RelName = keyof typeof Rel\n\n` +
    `/** Live node-kind ids. */\nexport const NodeKind = {\n${kindEnum}\n} as const\n` +
    `export type NodeKindName = keyof typeof NodeKind\n\n` +
    `export interface RelTypeMeta {\n  id: number\n  name: string\n  srcNs: string | null\n  dstNs: string | null\n  status: 'live' | 'reserved' | 'retired'\n  ordSemantics: string | null\n}\n` +
    `/** Full catalog incl. reserved/retired (retired kept so ids are never reused). */\n` +
    `export const REL_TYPES: readonly RelTypeMeta[] = [\n${relMeta}\n]\n\n` +
    `/** Logical table → column names, generated from the DDL. */\n` +
    `export const TABLES = {\n${tables}\n} as const\n`

  const dir = join(REPO, 'generated', 'ts')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'bundleSpec.ts'), out)
  return join(dir, 'bundleSpec.ts')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitTs())
