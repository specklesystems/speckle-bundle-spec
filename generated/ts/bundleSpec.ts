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
  IN_GROUP: 17,
  IN_ASSEMBLY: 18,
  CONNECTS_TO: 21,
  HOSTED_ON: 22,
  BOUNDS: 23,
  PLACES: 24,
  DEFINES_MEMBER: 25,
  OBJECT_HAS_MATERIAL: 26,
  OBJECT_HAS_COLOR: 27,
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
  { id: 2, name: 'SOLID', srcNs: 'object', dstNs: 'geometry', status: 'live', ordSemantics: 'ordinal' },
  { id: 3, name: 'SUBELEMENT', srcNs: 'object', dstNs: 'object', status: 'live', ordSemantics: 'ordinal' },
  { id: 4, name: 'DEFINES', srcNs: 'node', dstNs: 'geometry', status: 'live', ordSemantics: 'ordinal' },
  { id: 5, name: 'HAS_MATERIAL', srcNs: 'geometry', dstNs: 'node', status: 'live', ordSemantics: null },
  { id: 6, name: 'HAS_COLOR', srcNs: 'geometry', dstNs: 'node', status: 'live', ordSemantics: null },
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
  { id: 17, name: 'IN_GROUP', srcNs: 'object', dstNs: 'node', status: 'live', ordSemantics: null },
  { id: 18, name: 'IN_ASSEMBLY', srcNs: 'object', dstNs: 'object', status: 'live', ordSemantics: 'ordinal' },
  { id: 19, name: 'IN_SUBASSEMBLY', srcNs: null, dstNs: null, status: 'retired', ordSemantics: null },
  { id: 20, name: 'XREF', srcNs: null, dstNs: null, status: 'retired', ordSemantics: null },
  { id: 21, name: 'CONNECTS_TO', srcNs: 'object', dstNs: 'object', status: 'live', ordSemantics: 'scope' },
  { id: 22, name: 'HOSTED_ON', srcNs: 'object', dstNs: 'object', status: 'live', ordSemantics: null },
  { id: 23, name: 'BOUNDS', srcNs: 'object', dstNs: 'object', status: 'live', ordSemantics: null },
  { id: 24, name: 'PLACES', srcNs: 'object', dstNs: 'node', status: 'live', ordSemantics: null },
  { id: 25, name: 'DEFINES_MEMBER', srcNs: 'node', dstNs: 'object', status: 'live', ordSemantics: 'ordinal' },
  { id: 26, name: 'OBJECT_HAS_MATERIAL', srcNs: 'object', dstNs: 'node', status: 'live', ordSemantics: null },
  { id: 27, name: 'OBJECT_HAS_COLOR', srcNs: 'object', dstNs: 'node', status: 'live', ordSemantics: null },
]

/** Logical table → column names, generated from the DDL. */
export const TABLES = {
  camera_views: ['view', 'name', 'is_default', 'ord', 'pos_x', 'pos_y', 'pos_z', 'forward_x', 'forward_y', 'forward_z', 'up_x', 'up_y', 'up_z', 'target_x', 'target_y', 'target_z', 'units', 'is_ortho', 'fov', 'lens_mm', 'ortho_height', 'aspect', 'near', 'far'],
  eav: ['object_index', 'path_index', 'value_string', 'value_double', 'value_boolean', 'unit', 'internal_definition_name'],
  geometries: ['geometryIndex', 'content', 'id', 'type'],
  model: ['path', 'value_string', 'value_double', 'value_boolean', 'unit'],
  nodes: ['id', 'kind', 'name', 'def_ref', 'transform', 'units', 'subtype', 'argb', 'opacity', 'metalness', 'roughness', 'emissive', 'ior', 'elevation', 'gh_topology'],
  object_type: ['object_index', 'type_index'],
  objects: ['object_index', 'application_id'],
  paths: ['path_index', 'path'],
  property_set_definitions: ['set_name', 'set_key', 'set_description', 'field_name', 'field_bucket_id', 'data_type', 'default_string', 'default_double', 'default_boolean', 'unit', 'description', 'applies_to'],
  relations: ['rel', 'src', 'dst', 'ord'],
  scene_views: ['view', 'name', 'is_default', 'ord', 'source', 'ref'],
  sgeo_flags: ['bit', 'name', 'applies_to', 'status', 'description', 'why'],
  sgeo_primitive_types: ['id', 'name', 'status', 'description'],
  structural_results: ['object_index', 'element_name', 'location', 'result_type', 'load_case', 'component', 'position_label', 'station', 'step', 'value', 'value_text'],
  type_eav: ['type_index', 'path_index', 'value_string', 'value_double', 'value_boolean', 'unit', 'internal_definition_name'],
  types: ['type_index', 'type_key'],
} as const
