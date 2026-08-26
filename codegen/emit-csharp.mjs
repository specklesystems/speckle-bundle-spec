// Emit generated/csharp/BundleSpec.cs — enums + catalog rows for the managed
// EnvelopeWriter, kept in lockstep with the native producer via the same spec.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  REPO,
  GENERATED_HEADER,
  relTypes,
  nodeKinds,
  schemaVersion
} from './lib/duck.mjs'

const s = (v) => (v == null ? 'null' : `"${String(v).replace(/"/g, '\\"')}"`)

export function emitCsharp() {
  const rels = relTypes()
  const kinds = nodeKinds()
  const live = (rows) => rows.filter((r) => r.status !== 'retired')

  const relEnum = live(rels)
    .map((r) => `    ${r.name} = ${r.id},`)
    .join('\n')
  const kindEnum = live(kinds)
    .map((k) => `    ${k.name} = ${k.id},`)
    .join('\n')
  const relRows = live(rels)
    .map(
      (r) =>
        `        new(${r.id}, ${s(r.name)}, ${s(r.src_ns)}, ${s(r.dst_ns)}, ${s(
          r.status
        )}),`
    )
    .join('\n')
  const kindRows = live(kinds)
    .map((k) => `        new(${k.id}, ${s(k.name)}, ${s(k.subtype_values)}),`)
    .join('\n')

  const out =
    GENERATED_HEADER('cs') +
    `namespace Speckle.Bundle.Spec;

public static class BundleSpec
{
    public const string SchemaVersion = "${schemaVersion()}";
}

public enum Rel
{
${relEnum}
}

public enum NodeKind
{
${kindEnum}
}

public readonly record struct RelTypeRow(int Id, string Name, string? SrcNs, string? DstNs, string Status);
public readonly record struct NodeKindRow(int Id, string Name, string? SubtypeValues);

public static class Catalog
{
    public static readonly RelTypeRow[] RelTypes =
    {
${relRows}
    };

    public static readonly NodeKindRow[] NodeKinds =
    {
${kindRows}
    };
}
`

  const dir = join(REPO, 'generated', 'csharp')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'BundleSpec.cs'), out)
  return join(dir, 'BundleSpec.cs')
}

if (import.meta.url === `file://${process.argv[1]}`)
  console.log('wrote', emitCsharp())
