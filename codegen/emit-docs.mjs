// Emit docs/reference.md — the human reference, generated so it can never drift
// from the spec. Long-form rationale stays hand-written in docs/rationale/.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  REPO,
  relTypes,
  nodeKinds,
  bundleFiles,
  tableColumns,
  schemaVersion
} from './lib/duck.mjs'

const cell = (v) => (v == null || v === '' ? '·' : String(v).replace(/\|/g, '\\|'))
const badge = (st) => ({ live: '🟢 live', reserved: '🟡 reserved', retired: '⚪ retired' }[st] ?? st)

export function emitDocs() {
  const rels = relTypes()
  const kinds = nodeKinds()
  const files = bundleFiles()
  const cols = tableColumns()

  let md = `<!-- GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT. Run npm run generate. -->\n`
  md += `# Speckle bundle format — reference (schema_version ${schemaVersion()})\n\n`
  md += `Generated from \`spec/bundle-spec.sql\`. Rationale & design history live in \`docs/rationale/\`.\n\n`

  md += `## Relations (\`rel_types\`)\n\n`
  md += `| id | name | src → dst | status | emitted by | ord | description / why |\n`
  md += `|---|---|---|---|---|---|---|\n`
  for (const r of rels) {
    const ns = r.status === 'retired' ? '·' : `${cell(r.src_ns)} → ${cell(r.dst_ns)}`
    const why = r.why ? `${cell(r.description)} — *${cell(r.why)}*` : cell(r.description)
    md += `| ${r.id} | **${r.name}** | ${ns} | ${badge(r.status)} | ${cell(r.emitted_by)} | ${cell(r.ord_semantics)} | ${why} |\n`
  }

  md += `\n## Node kinds (\`node_kinds\`)\n\n`
  md += `| id | name | status | columns | subtypes | description / why |\n`
  md += `|---|---|---|---|---|---|\n`
  for (const k of kinds) {
    const why = k.why ? `${cell(k.description)} — *${cell(k.why)}*` : cell(k.description)
    md += `| ${k.id} | **${k.name}** | ${badge(k.status)} | ${cell(k.columns)} | ${cell(k.subtype_values)} | ${why} |\n`
  }

  md += `\n## Bundle manifest (\`bundle_files\`)\n\n`
  md += `| name | read glob | sharded | required | self-describing | description |\n`
  md += `|---|---|---|---|---|---|\n`
  for (const f of files) {
    md += `| \`${f.name}\` | \`${f.file_glob}\` | ${f.sharded ? 'yes' : 'no'} | ${f.required ? 'yes' : 'no'} | ${f.self_describing ? 'yes' : 'no'} | ${cell(f.description)} |\n`
  }

  md += `\n## Table shapes\n\n`
  const byTable = {}
  for (const c of cols) (byTable[c.table_name] ??= []).push(c)
  for (const [t, cs] of Object.entries(byTable)) {
    md += `### \`${t}\`\n\n| column | type | note |\n|---|---|---|\n`
    for (const c of cs) md += `| ${c.column_name} | ${c.data_type} | ${cell(c.comment)} |\n`
    md += `\n`
  }

  const path = join(REPO, 'docs', 'reference.md')
  writeFileSync(path, md)
  return path
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('wrote', emitDocs())
