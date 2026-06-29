// Emit generated/cpp/envelope_spec.h — enums + the catalog rows the native
// producers ship. Replaces the hand-written arrays in envelope_catalog.h:
// iterate REL_TYPES/NODE_KINDS instead of positional const char* arrays.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  REPO,
  GENERATED_HEADER,
  relTypes,
  nodeKinds,
  schemaVersion
} from './lib/duck.mjs'

const s = (v) => (v == null ? 'nullptr' : `"${String(v).replace(/"/g, '\\"')}"`)

export function emitCpp() {
  const rels = relTypes()
  const kinds = nodeKinds()
  const live = (rows) => rows.filter((r) => r.status !== 'retired')
  // Producers ship the catalog for live + reserved (reserved documents intent).
  const shipped = (rows) => rows.filter((r) => r.status !== 'retired')

  const relEnum = live(rels)
    .map((r) => `  ${r.name} = ${r.id},`)
    .join('\n')
  const kindEnum = live(kinds)
    .map((k) => `  ${k.name} = ${k.id},`)
    .join('\n')

  const relRows = shipped(rels)
    .map(
      (r) =>
        `  {${r.id}, ${s(r.name)}, ${s(r.src_ns)}, ${s(r.dst_ns)}, ${s(r.status)}},`
    )
    .join('\n')
  const kindRows = shipped(kinds)
    .map((k) => `  {${k.id}, ${s(k.name)}, ${s(k.subtype_values)}},`)
    .join('\n')

  const out =
    GENERATED_HEADER('cpp') +
    `#pragma once
#include <cstdint>

namespace bundlespec {

constexpr int kSchemaVersion = ${schemaVersion()};

enum class Rel : int {
${relEnum}
};

enum class NodeKind : int {
${kindEnum}
};

struct RelTypeRow { int id; const char* name; const char* src_ns; const char* dst_ns; const char* status; };
struct NodeKindRow { int id; const char* name; const char* subtype_values; };

// The catalog producers write into envelope.rel_types / envelope.node_kinds
// (live + reserved; retired ids are omitted but never reused).
static const RelTypeRow kRelTypes[] = {
${relRows}
};
static const NodeKindRow kNodeKinds[] = {
${kindRows}
};

}  // namespace bundlespec
`

  const dir = join(REPO, 'generated', 'cpp')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'envelope_spec.h'), out)
  return join(dir, 'envelope_spec.h')
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitCpp())
