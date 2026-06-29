// DuckDB column type → target representations. The spec's DDL types are the SoT;
// producers build their Arrow/Parquet schemas from these mappings.
const MAP = {
  INTEGER: { arrowCpp: 'arrow::int32()', cs: 'Int32' },
  BIGINT: { arrowCpp: 'arrow::int64()', cs: 'Int64' },
  VARCHAR: { arrowCpp: 'arrow::utf8()', cs: 'Utf8' },
  DOUBLE: { arrowCpp: 'arrow::float64()', cs: 'Float64' },
  BOOLEAN: { arrowCpp: 'arrow::boolean()', cs: 'Boolean' },
  BLOB: { arrowCpp: 'arrow::binary()', cs: 'Binary' }
}

export function mapType(duckType) {
  const key = String(duckType).toUpperCase().trim()
  const t = MAP[key]
  if (!t) throw new Error(`unmapped DuckDB type: ${duckType}`)
  return t
}

/** All target type tokens used (for emitting the C# ArrowType enum). */
export const CS_TYPES = [...new Set(Object.values(MAP).map((t) => t.cs))]

/** snake_case table name → camelCase identifier (eav → eav, object_type → objectType). */
export const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
