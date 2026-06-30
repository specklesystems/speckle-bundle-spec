// Emit generated/python/bundle_spec.py — Rel/NodeKind IntEnums + catalog rows +
// SCHEMA_VERSION the specklepy producer imports instead of hardcoding rel/kind ids.
// Zero runtime deps (stdlib enum / typing only) so it vendors cleanly into specklepy.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  REPO,
  GENERATED_HEADER,
  relTypes,
  nodeKinds,
  schemaVersion
} from './lib/duck.mjs'

// Python repr for a nullable string catalog value.
const q = (v) => (v == null ? 'None' : `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)

export function emitPython() {
  const rels = relTypes()
  const kinds = nodeKinds()
  const live = (rows) => rows.filter((r) => r.status !== 'retired')

  const relEnum = live(rels)
    .map((r) => `    ${r.name} = ${r.id}`)
    .join('\n')
  const kindEnum = live(kinds)
    .map((k) => `    ${k.name} = ${k.id}`)
    .join('\n')

  // Full catalog incl. reserved/retired (retired kept so ids are never reused) — the
  // self-describing rel_types / node_kinds tables a producer ships in the bundle.
  const relRows = rels
    .map(
      (r) =>
        `    RelTypeRow(${r.id}, ${q(r.name)}, ${q(r.src_ns)}, ${q(r.dst_ns)}, ${q(r.status)}, ${q(r.ord_semantics)}),`
    )
    .join('\n')
  const kindRows = kinds
    .map((k) => `    NodeKindRow(${k.id}, ${q(k.name)}, ${q(k.status)}, ${q(k.subtype_values)}),`)
    .join('\n')

  const out =
    GENERATED_HEADER('py') +
    `"""Speckle bundle vocabulary (schema_version ${schemaVersion()}).

Single source of truth: speckle-bundle-spec/spec/bundle-spec.sql. Regenerate with
\`node codegen/generate-all.mjs\` in that repo, then re-vendor into specklepy.
"""

from enum import IntEnum
from typing import NamedTuple, Optional

SCHEMA_VERSION = ${schemaVersion()}


class Rel(IntEnum):
    """Live relation ids (typed envelope edges)."""

${relEnum}


class NodeKind(IntEnum):
    """Live node-kind ids (synthetic envelope nodes)."""

${kindEnum}


class RelTypeRow(NamedTuple):
    id: int
    name: str
    src_ns: Optional[str]
    dst_ns: Optional[str]
    status: str
    ord_semantics: Optional[str]


class NodeKindRow(NamedTuple):
    id: int
    name: str
    status: str
    subtype_values: Optional[str]


# Full catalogs incl. reserved/retired rows (ids are retired in place, never reused),
# shipped in the bundle as the self-describing rel_types / node_kinds tables.
REL_TYPES: list[RelTypeRow] = [
${relRows}
]

NODE_KINDS: list[NodeKindRow] = [
${kindRows}
]
`

  const dir = join(REPO, 'generated', 'python')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'bundle_spec.py'), out)
  return join(dir, 'bundle_spec.py')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitPython())
