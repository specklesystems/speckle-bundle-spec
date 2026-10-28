// Emit generated/docs-data.json — the same live relation and node-kind catalog as
// docs/reference.md, as data instead of markdown, so an external docs site can
// render its own tables from the spec instead of hand-copying them out of it.
//
// Scope: today this feeds speckle-docs-NEW's /next/developers/object-model pages
// (relations + node kinds only). Row-shaped tables (tableRows() in lib/tables.mjs)
// aren't included — add them here if/when a docs page needs them, rather than
// growing this file's shape speculatively.
//
// Only LIVE entries are included. A retired relation or kind is spec history, not
// something a consumer will ever see on the wire, and the docs explicitly document
// "what you will see" — carrying retired rows into this file would just push the
// filtering decision onto every consumer instead of making it once, here.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, relTypes, nodeKinds, schemaVersion } from './lib/duck.mjs'
import { nodeKindFields } from './lib/kinds.mjs'

const csv = (s) =>
  s
    ? s
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : []

export function emitDocsData() {
  const relations = relTypes()
    .filter((r) => r.status !== 'retired')
    .map((r) => ({
      id: r.id,
      name: r.name,
      src: r.src_ns,
      dst: r.dst_ns,
      status: r.status,
      emittedBy: csv(r.emitted_by),
      ordSemantics: r.ord_semantics ?? null,
      description: r.description ?? null,
      why: r.why ?? null
    }))

  // nodeKindFields() already resolves node_kinds.columns against the nodes DDL
  // (duckType + optional per field) — the same call the per-language node-record
  // emitters use, so this can never describe a field shape the generated SDK
  // classes don't also have. It only carries id/name/description/fields, so the
  // remaining catalog columns (why, subtype_values) are joined back in here.
  const kindMeta = new Map(nodeKinds().map((k) => [k.id, k]))
  const nodeKindData = nodeKindFields().map((k) => {
    const meta = kindMeta.get(k.id)
    return {
      id: k.id,
      name: k.name,
      description: k.description ?? null,
      why: meta?.why ?? null,
      subtypes: csv(meta?.subtype_values),
      fields: k.fields.map((f) => ({
        column: f.column,
        type: f.duckType,
        optional: f.optional
      }))
    }
  })

  const data = {
    schemaVersion: schemaVersion(),
    generatedFrom: 'spec/bundle-spec.sql',
    relations,
    nodeKinds: nodeKindData
  }

  const path = join(REPO, 'generated', 'docs-data.json')
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
  return path
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitDocsData())
