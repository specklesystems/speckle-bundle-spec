// Emit generated/csharp/BundleSchemas.cs — a typed column descriptor per produced
// table. Library-agnostic on purpose: the managed writer maps ArrowType → its own
// field builder once (Apache.Arrow / Parquet.NET), then builds every table schema
// from these descriptors instead of hand-declaring them.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, GENERATED_HEADER, tableColumns } from './lib/duck.mjs'
import { mapType, camel, CS_TYPES } from './lib/types.mjs'

const pascal = (s) => {
  const c = camel(s)
  return c.charAt(0).toUpperCase() + c.slice(1)
}

export function emitCsharpSchemas() {
  const cols = tableColumns()
  const byTable = {}
  for (const c of cols) (byTable[c.table_name] ??= []).push(c)

  const tableProps = Object.entries(byTable)
    .map(([table, cs]) => {
      const fields = cs
        .map(
          (c) =>
            `        new("${c.column_name}", ArrowType.${mapType(c.data_type).cs}, ${c.is_nullable ? 'true' : 'false'}),`
        )
        .join('\n')
      return `    public static readonly ColumnSpec[] ${pascal(table)} =\n    {\n${fields}\n    };`
    })
    .join('\n\n')

  const byTableMap = Object.keys(byTable)
    .map((t) => `        ["${t}"] = ${pascal(t)},`)
    .join('\n')

  const out =
    GENERATED_HEADER('cs') +
    `using System.Collections.Generic;

namespace Speckle.Bundle.Spec;

public enum ArrowType
{
${CS_TYPES.map((t) => `    ${t},`).join('\n')}
}

public readonly record struct ColumnSpec(string Name, ArrowType Type, bool Nullable);

public static class BundleSchemas
{
${tableProps}

    public static readonly IReadOnlyDictionary<string, ColumnSpec[]> ByTable =
        new Dictionary<string, ColumnSpec[]>
        {
${byTableMap}
        };
}
`

  const dir = join(REPO, 'generated', 'csharp')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'BundleSchemas.cs'), out)
  return join(dir, 'BundleSchemas.cs')
}

if (import.meta.url === `file://${process.argv[1]}`)
  console.log('wrote', emitCsharpSchemas())
