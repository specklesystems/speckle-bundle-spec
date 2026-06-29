// GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT.
// Run `npm run generate` (or node codegen/generate-all.mjs) to refresh.

export const SCHEMA_VERSION = 5 as const

/** Live relation ids. */
export const Rel = {
  DISPLAY: 1,
  SOLID: 2,
  SUBELEMENT: 3,
  DEFINES: 4,
  HAS_MATERIAL: 5,
  HAS_COLOR: 6,
  ON_LEVEL: 7,
  DISPLAY_INSTANCE: 8,
  DEFINES_INSTANCE: 9,
  IN_COLLECTION: 10,
  IN_MODEL: 11,
  IN_ROOM: 12,
  IN_SYSTEM: 14,
  CONNECTS_TO: 21,
  BOUNDS: 23,
} as const
export type RelName = keyof typeof Rel

/** Live node-kind ids. */
export const NodeKind = {
  DEFINITION: 1,
  INSTANCE: 2,
  MATERIAL: 3,
  COLOR: 4,
  LEVEL: 5,
  CONTAINER: 7,
} as const
export type NodeKindName = keyof typeof NodeKind

export interface RelTypeMeta {
  id: number
  name: string
  srcNs: string | null
  dstNs: string | null
  status: 'live' | 'reserved' | 'retired'
  ordSemantics: string | null
}
/** Full catalog incl. reserved/retired (retired kept so ids are never reused). */
export const REL_TYPES: readonly RelTypeMeta[] = [
  { id: 1, name: 'DISPLAY', srcNs: 'object', dstNs: 'geometry', status: 'live', ordSemantics: 'ordinal' },
  { id: 2, name: 'SOLID', srcNs: 'object', dstNs: 'geometry', status: 'reserved', ordSemantics: 'ordinal' },
  { id: 3, name: 'SUBELEMENT', srcNs: 'object', dstNs: 'object', status: 'live', ordSemantics: 'ordinal' },
  { id: 4, name: 'DEFINES', srcNs: 'node', dstNs: 'geometry', status: 'live', ordSemantics: null },
  { id: 5, name: 'HAS_MATERIAL', srcNs: 'geometry', dstNs: 'node', status: 'live', ordSemantics: null },
  { id: 6, name: 'HAS_COLOR', srcNs: 'geometry|object', dstNs: 'node', status: 'live', ordSemantics: null },
  { id: 7, name: 'ON_LEVEL', srcNs: 'object', dstNs: 'node', status: 'live', ordSemantics: null },
  { id: 8, name: 'DISPLAY_INSTANCE', srcNs: 'object', dstNs: 'node', status: 'live', ordSemantics: 'ordinal' },
  { id: 9, name: 'DEFINES_INSTANCE', srcNs: 'node', dstNs: 'node', status: 'live', ordSemantics: 'ordinal' },
  { id: 10, name: 'IN_COLLECTION', srcNs: 'object', dstNs: 'node', status: 'live', ordSemantics: null },
  { id: 11, name: 'IN_MODEL', srcNs: 'object', dstNs: 'node', status: 'live', ordSemantics: null },
  { id: 12, name: 'IN_ROOM', srcNs: 'object', dstNs: 'object', status: 'live', ordSemantics: null },
  { id: 13, name: 'IN_SPACE', srcNs: null, dstNs: null, status: 'retired', ordSemantics: null },
  { id: 14, name: 'IN_SYSTEM', srcNs: 'object', dstNs: 'node', status: 'live', ordSemantics: null },
  { id: 15, name: 'IN_NETWORK', srcNs: null, dstNs: null, status: 'retired', ordSemantics: null },
  { id: 16, name: 'IN_LINE', srcNs: null, dstNs: null, status: 'retired', ordSemantics: null },
  { id: 17, name: 'IN_GROUP', srcNs: null, dstNs: null, status: 'retired', ordSemantics: null },
  { id: 18, name: 'IN_ASSEMBLY', srcNs: null, dstNs: null, status: 'retired', ordSemantics: null },
  { id: 19, name: 'IN_SUBASSEMBLY', srcNs: null, dstNs: null, status: 'retired', ordSemantics: null },
  { id: 20, name: 'XREF', srcNs: null, dstNs: null, status: 'retired', ordSemantics: null },
  { id: 21, name: 'CONNECTS_TO', srcNs: 'object', dstNs: 'object', status: 'live', ordSemantics: 'scope' },
  { id: 22, name: 'HOSTED_ON', srcNs: null, dstNs: null, status: 'retired', ordSemantics: null },
  { id: 23, name: 'BOUNDS', srcNs: 'object', dstNs: 'object', status: 'live', ordSemantics: null },
]

/** Logical table → column names, generated from the DDL. */
export const TABLES = {
  duckdb_columns: ['database_name', 'database_oid', 'schema_name', 'schema_oid', 'table_name', 'table_oid', 'column_name', 'column_index', 'comment', 'internal', 'column_default', 'is_nullable', 'data_type', 'data_type_id', 'character_maximum_length', 'numeric_precision', 'numeric_precision_radix', 'numeric_scale'],
  duckdb_constraints: ['database_name', 'database_oid', 'schema_name', 'schema_oid', 'table_name', 'table_oid', 'constraint_index', 'constraint_type', 'constraint_text', 'expression', 'constraint_column_indexes', 'constraint_column_names', 'constraint_name', 'referenced_table', 'referenced_column_names'],
  duckdb_databases: ['database_name', 'database_oid', 'path', 'comment', 'tags', 'internal', 'type', 'readonly', 'encrypted', 'cipher', 'options'],
  duckdb_indexes: ['database_name', 'database_oid', 'schema_name', 'schema_oid', 'index_name', 'index_oid', 'table_name', 'table_oid', 'comment', 'tags', 'is_unique', 'is_primary', 'expressions', 'sql'],
  duckdb_logs: ['context_id', 'scope', 'connection_id', 'transaction_id', 'query_id', 'thread_id', 'timestamp', 'type', 'log_level', 'message'],
  duckdb_schemas: ['oid', 'database_name', 'database_oid', 'schema_name', 'comment', 'tags', 'internal', 'sql'],
  duckdb_tables: ['database_name', 'database_oid', 'schema_name', 'schema_oid', 'table_name', 'table_oid', 'comment', 'tags', 'internal', 'temporary', 'has_primary_key', 'estimated_size', 'column_count', 'index_count', 'check_constraint_count', 'sql'],
  duckdb_types: ['database_name', 'database_oid', 'schema_name', 'schema_oid', 'type_oid', 'type_name', 'type_size', 'logical_type', 'type_category', 'comment', 'tags', 'internal', 'labels'],
  duckdb_views: ['database_name', 'database_oid', 'schema_name', 'schema_oid', 'view_name', 'view_oid', 'comment', 'tags', 'internal', 'temporary', 'column_count', 'sql', 'is_bound'],
  eav: ['object_index', 'path_index', 'value_string', 'value_double', 'value_boolean', 'unit', 'internal_definition_name'],
  geometries: ['geometryIndex', 'content', 'id', 'type'],
  nodes: ['id', 'kind', 'name', 'def_ref', 'transform', 'units', 'subtype', 'argb', 'opacity', 'metalness', 'roughness', 'elevation'],
  object_type: ['object_index', 'type_index'],
  objects: ['object_index', 'application_id'],
  paths: ['path_index', 'path'],
  pragma_database_list: ['seq', 'name', 'file'],
  relations: ['rel', 'src', 'dst', 'ord'],
  scene_views: ['view', 'name', 'is_default', 'ord', 'source', 'ref'],
  sqlite_master: ['type', 'name', 'tbl_name', 'rootpage', 'sql'],
  sqlite_schema: ['type', 'name', 'tbl_name', 'rootpage', 'sql'],
  sqlite_temp_master: ['type', 'name', 'tbl_name', 'rootpage', 'sql'],
  sqlite_temp_schema: ['type', 'name', 'tbl_name', 'rootpage', 'sql'],
  type_eav: ['type_index', 'path_index', 'value_string', 'value_double', 'value_boolean', 'unit', 'internal_definition_name'],
  types: ['type_index', 'type_key'],
} as const
