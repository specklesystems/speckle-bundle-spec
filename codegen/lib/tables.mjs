// Row field sets for flat tables — the physical DDL, straight. Unlike node kinds there
// is no per-kind column subset: every row has the same shape, and optionality is the
// DDL's NOT NULL rather than a `?` marker.
import { tableColumns } from './duck.mjs'

// Only tables whose row is worth a caller-facing record. Most tables (eav, objects,
// paths, relations) are bulk storage written a column at a time, not a row a producer
// hands over — so the selection is curated here rather than marked in the spec.
const ROW_TABLES = {
  structural_results: 'StructuralResult',
  property_set_definitions: 'PropertySetField',
  camera_views: 'CameraView',
}

/** Row tables as { table, typeName, fields: [{ column, duckType, optional, defaulted, comment }] }. */
export function tableRows() {
  const byTable = {}
  for (const c of tableColumns()) (byTable[c.table_name] ??= []).push(c)

  return Object.entries(ROW_TABLES).map(([table, typeName]) => {
    const cols = byTable[table]
    if (!cols?.length) {
      throw new Error(`row table "${table}" is not in the spec DDL`)
    }
    // Every target language allows a default only on trailing parameters, so only the
    // final unbroken run of nullable columns can carry one. Declaration order stays the
    // DDL's — that 1:1 correspondence with the row is the point of the record.
    let firstDefault = cols.length
    while (firstDefault > 0 && cols[firstDefault - 1].is_nullable) {
      firstDefault--
    }
    return {
      table,
      typeName,
      fields: cols.map((c, i) => ({
        column: c.column_name,
        duckType: c.data_type,
        optional: c.is_nullable,
        defaulted: i >= firstDefault,
        comment: c.comment ?? null,
      })),
    }
  })
}
