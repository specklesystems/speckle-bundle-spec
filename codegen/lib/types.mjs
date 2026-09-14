// DuckDB column type → target representations. The spec's DDL types are the SoT;
// producers build their Arrow/Parquet schemas from these mappings.
// cs/py are ArrowType tokens for the schema descriptors; clr/pyType/tsType/cppType
// are the language-native types the per-kind node records are built from.
const MAP = {
  INTEGER: { arrowCpp: 'arrow::int32()', cs: 'Int32', py: 'int32', clr: 'int', pyType: 'int', tsType: 'number', cppType: 'int32_t' },
  BIGINT: { arrowCpp: 'arrow::int64()', cs: 'Int64', py: 'int64', clr: 'long', pyType: 'int', tsType: 'number', cppType: 'int64_t' },
  VARCHAR: { arrowCpp: 'arrow::utf8()', cs: 'Utf8', py: 'string', clr: 'string', pyType: 'str', tsType: 'string', cppType: 'std::string' },
  DOUBLE: { arrowCpp: 'arrow::float64()', cs: 'Float64', py: 'float64', clr: 'double', pyType: 'float', tsType: 'number', cppType: 'double' },
  BOOLEAN: { arrowCpp: 'arrow::boolean()', cs: 'Boolean', py: 'bool', clr: 'bool', pyType: 'bool', tsType: 'boolean', cppType: 'bool' },
  BLOB: { arrowCpp: 'arrow::binary()', cs: 'Binary', py: 'binary', clr: 'byte[]', pyType: 'bytes', tsType: 'Uint8Array', cppType: 'std::vector<uint8_t>' }
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

/** any-case identifier → snake_case (geometryIndex → geometry_index, def_ref → def_ref). */
export const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()

/** snake_case → PascalCase (def_ref → DefRef, gh_topology → GhTopology). */
export const pascal = (s) => {
  const c = camel(s)
  return c.charAt(0).toUpperCase() + c.slice(1)
}

/** SCREAMING kind name → PascalCase type name (MATERIAL → Material). */
export const kindTypeName = (name) => name.charAt(0) + name.slice(1).toLowerCase()
