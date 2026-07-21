-- ════════════════════════════════════════════════════════════════════════════
--  Speckle bundle format — SINGLE SOURCE OF TRUTH   (schema_version 5)
-- ════════════════════════════════════════════════════════════════════════════
--  This file IS the spec. It is executable DuckDB SQL:
--    • CREATE TABLE …            → the shape of every parquet in the bundle
--    • COMMENT ON …              → per-column / per-table semantics
--    • CREATE TABLE + INSERT …   → the semantic catalogs (rel_types, node_kinds,
--                                  bundle_files) — the "why" rides as columns
--
--  Codegen runs this file in DuckDB, then SELECTs the catalogs/columns and
--  templates per-language constants. The validator attaches a real bundle and
--  compares it against these definitions. Long-form rationale lives in
--  docs/rationale/ and links back here; this file owns schema + short semantics.
--
--  Numbering rule: ids are RETIRED IN PLACE, never reused (status='retired').
--  Gaps are intentional. Edit this file; never hand-edit generated/ outputs.
-- ════════════════════════════════════════════════════════════════════════════

-- ── meta ─────────────────────────────────────────────────────────────────────
CREATE TABLE meta (schema_version INTEGER, produced_by VARCHAR);
INSERT INTO meta VALUES (5, 'speckle-bundle-spec');

-- ════════════════════════════════════════════════════════════════════════════
--  PART 1 — table shapes (DDL). Logical names match the views a consumer sees
--  after attaching a bundle (the on-disk files are `{base}.<group>.<name>.parquet`;
--  see bundle_files for the mapping).
-- ════════════════════════════════════════════════════════════════════════════

-- ── eav (the data: objects + flattened attributes) ───────────────────────────
CREATE TABLE objects (
  object_index   INTEGER NOT NULL,
  application_id VARCHAR NOT NULL
);
COMMENT ON TABLE objects IS 'Object identity registry — pure identity, all attributes live in eav.';
COMMENT ON COLUMN objects.object_index IS 'Dense int K (the object K-space). Relations with src_ns/dst_ns=object reference this.';
COMMENT ON COLUMN objects.application_id IS 'Source-stable id; the flat WorldTree node id IS this.';

CREATE TABLE paths (
  path_index INTEGER NOT NULL,
  path       VARCHAR NOT NULL
);
COMMENT ON TABLE paths IS 'Shared attribute-name dictionary, interned once, reused by eav / type_eav / (node attrs).';

CREATE TABLE eav (
  object_index             INTEGER NOT NULL,
  path_index               INTEGER NOT NULL,
  value_string             VARCHAR,
  value_double             DOUBLE,
  value_boolean            BOOLEAN,
  unit                     VARCHAR,
  internal_definition_name VARCHAR
);
COMMENT ON TABLE eav IS 'Per-object flattened attributes (entity-attribute-value). Unbounded, self-describing via paths.';
COMMENT ON COLUMN eav.value_string IS 'Exactly one of value_string/value_double/value_boolean is set; consumer coalesces.';

CREATE TABLE types (
  type_index INTEGER NOT NULL,
  type_key   VARCHAR NOT NULL
);
COMMENT ON TABLE types IS 'Deduped type / shared-parameter groups (content-hash keyed).';

CREATE TABLE type_eav (
  type_index               INTEGER NOT NULL,
  path_index               INTEGER NOT NULL,
  value_string             VARCHAR,
  value_double             DOUBLE,
  value_boolean            BOOLEAN,
  unit                     VARCHAR,
  internal_definition_name VARCHAR
);
COMMENT ON TABLE type_eav IS 'Type-scoped attributes (same shape as eav, keyed by type_index).';

CREATE TABLE object_type (
  object_index INTEGER NOT NULL,
  type_index   INTEGER NOT NULL
);
COMMENT ON TABLE object_type IS 'Object → type weak reference (an object inherits its type_eav rows).';

-- ── envelope (the graph: synthetic nodes + typed edges) ──────────────────────
CREATE TABLE nodes (
  id        INTEGER NOT NULL,
  kind      INTEGER NOT NULL,
  name      VARCHAR,
  def_ref   INTEGER,
  transform VARCHAR,
  units     VARCHAR,
  subtype   VARCHAR,
  argb      INTEGER,
  opacity   DOUBLE,
  metalness DOUBLE,
  roughness DOUBLE,
  elevation DOUBLE
);
COMMENT ON TABLE nodes IS 'Synthetic graph nodes. Bounded STRUCTURAL scaffolding (fixed columns) — unbounded/source-variable metadata belongs on objects (eav), never here. Add a column only for a genuinely new structural scalar.';
COMMENT ON COLUMN nodes.id IS 'Dense int K (the node K-space, distinct from object_index). Overlaps geometry K numerically — disambiguate by the rel''s namespaces.';
COMMENT ON COLUMN nodes.kind IS 'NodeKind discriminator (see node_kinds catalog).';
COMMENT ON COLUMN nodes.def_ref IS 'Node→node K reference: INSTANCE→DEFINITION, or CONTAINER→parent container (tree nesting).';
COMMENT ON COLUMN nodes.transform IS 'INSTANCE only. Row-major 4x4 as CSV. HOT: bulk-scanned per instance (100k–1M) on load — must stay columnar.';
COMMENT ON COLUMN nodes.units IS 'INSTANCE placement units; read in the same hot scan as transform.';
COMMENT ON COLUMN nodes.subtype IS 'CONTAINER polymorphism: Collection | Model | MEP System | Network. The single grouping discriminator (replaced the former units-overload).';
COMMENT ON COLUMN nodes.argb IS 'MATERIAL/COLOR packed colour.';
COMMENT ON COLUMN nodes.elevation IS 'LEVEL height — lets the scene tree order storeys architecturally.';

CREATE TABLE relations (
  rel INTEGER NOT NULL,
  src INTEGER NOT NULL,
  dst INTEGER NOT NULL,
  ord INTEGER
);
COMMENT ON TABLE relations IS 'Typed graph edges (rel, src, dst, ord). src/dst are interpreted via the rel''s src_ns/dst_ns.';
COMMENT ON COLUMN relations.ord IS 'Dual-use: ORDINAL for ordered rels (DISPLAY, SUBELEMENT, *_INSTANCE); SCOPE tag for graph edges (CONNECTS_TO ord=system-K/opening-K, 0=unscoped). See rel_types.ord_semantics.';

-- ── geometry ─────────────────────────────────────────────────────────────────
CREATE TABLE geometries (
  geometryIndex INTEGER NOT NULL,
  content       BLOB,
  id            VARCHAR,
  type          VARCHAR
);
COMMENT ON TABLE geometries IS 'SGEO mesh blobs, content-hash deduped. Geometry K-space; referenced by rels whose ns=geometry.';

-- ── scene_views (optional, producer-authored default projection) ─────────────
CREATE TABLE scene_views (
  view       INTEGER NOT NULL,
  name       VARCHAR,
  is_default BOOLEAN,
  ord        INTEGER,
  source     VARCHAR,   -- 'rel' | 'eav'
  ref        VARCHAR    -- a rel id (as text) or an eav path
);
COMMENT ON TABLE scene_views IS 'Ordered tiers (outermost-first) of the producer-authored default scene-explorer grouping. Absent ⇒ consumer falls back to a heuristic.';

-- ── camera_views (optional, named camera viewpoints) ─────────────────────────
CREATE TABLE camera_views (
  view         INTEGER NOT NULL,
  name         VARCHAR,
  is_default   BOOLEAN,
  ord          INTEGER,
  pos_x        DOUBLE NOT NULL,
  pos_y        DOUBLE NOT NULL,
  pos_z        DOUBLE NOT NULL,
  forward_x    DOUBLE NOT NULL,
  forward_y    DOUBLE NOT NULL,
  forward_z    DOUBLE NOT NULL,
  up_x         DOUBLE NOT NULL,
  up_y         DOUBLE NOT NULL,
  up_z         DOUBLE NOT NULL,
  target_x     DOUBLE,
  target_y     DOUBLE,
  target_z     DOUBLE,
  units        VARCHAR,
  is_ortho     BOOLEAN,
  fov          DOUBLE,
  lens_mm      DOUBLE,
  ortho_height DOUBLE,
  aspect       DOUBLE,
  near         DOUBLE,
  far          DOUBLE
);
COMMENT ON TABLE camera_views IS 'Named camera viewpoints authored in the source model (named views / scenes / 3D views). NOT scene_views (which is the explorer grouping). One row per view. Absent ⇒ the model ships no viewpoints.';
COMMENT ON COLUMN camera_views.view IS 'Dense ordinal, unique per row (the camera-view K-space; references nothing).';
COMMENT ON COLUMN camera_views.name IS 'Display label; consumer shows name ?? view.';
COMMENT ON COLUMN camera_views.is_default IS 'Producer-nominated home/startup view. At most one row true.';
COMMENT ON COLUMN camera_views.ord IS 'Display order in view menus.';
COMMENT ON COLUMN camera_views.pos_x IS 'Camera eye position, in `units` (model units — consumer scales like geometry).';
COMMENT ON COLUMN camera_views.forward_x IS 'View direction. UNIT VECTOR, unitless. Required — target is derivable as pos + forward.';
COMMENT ON COLUMN camera_views.up_x IS 'Camera up. UNIT VECTOR, unitless.';
COMMENT ON COLUMN camera_views.target_x IS 'Explicit look-at point, in `units`. Optional — null when the host has no real target (e.g. Revit).';
COMMENT ON COLUMN camera_views.units IS 'Units of pos/target/ortho_height/near/far.';
COMMENT ON COLUMN camera_views.is_ortho IS 'True = parallel/orthographic projection; false = perspective.';
COMMENT ON COLUMN camera_views.fov IS 'VERTICAL field of view in DEGREES. Perspective only; null for ortho.';
COMMENT ON COLUMN camera_views.lens_mm IS '35mm-equivalent lens / focal length in millimetres (Rhino Camera35mmLensLength, SketchUp focal_length). Perspective only.';
COMMENT ON COLUMN camera_views.ortho_height IS 'Ortho view height, in `units`. Null for perspective.';
COMMENT ON COLUMN camera_views.aspect IS 'Frame aspect ratio (width/height), if the host has one.';
COMMENT ON COLUMN camera_views.near IS 'Near clipping distance, in `units`.';
COMMENT ON COLUMN camera_views.far IS 'Far clipping distance, in `units`.';

-- ════════════════════════════════════════════════════════════════════════════
--  PART 2 — semantic catalogs (data). These tables carry the vocabulary AND its
--  meaning. rel_types / node_kinds also SHIP in the bundle (a consumer may read
--  them at runtime); the extra semantic columns make a bundle self-documenting.
-- ════════════════════════════════════════════════════════════════════════════

-- ── rel_types ────────────────────────────────────────────────────────────────
--   status        : live | reserved | retired
--   src_ns/dst_ns : object | node | geometry | 'geometry|object' (null when retired)
--   ord_semantics : ordinal | scope | (null)
CREATE TABLE rel_types (
  id            INTEGER PRIMARY KEY,
  name          VARCHAR NOT NULL,
  src_ns        VARCHAR,
  dst_ns        VARCHAR,
  status        VARCHAR NOT NULL,
  emitted_by    VARCHAR,      -- csv of producers: rvextract | nwextract | managed
  ord_semantics VARCHAR,
  description   VARCHAR,
  why           VARCHAR
);
INSERT INTO rel_types
  (id, name,               src_ns,            dst_ns,     status,     emitted_by,            ord_semantics, description, why) VALUES
  (1,  'DISPLAY',          'object',          'geometry', 'live',     'rvextract',           'ordinal', 'Object → its own mesh.',                          'Top-level direct meshes (walls, in-place). Navis never uses it — everything there is an instance.'),
  (2,  'SOLID',            'object',          'geometry', 'reserved', NULL,                  'ordinal', 'Solid body, distinct from a display mesh.',       'Reserved: Rhino/Civil3D will distinguish true solids from tessellated display meshes.'),
  (3,  'SUBELEMENT',       'object',          'object',   'live',     'rvextract',           'ordinal', 'Parent → child containment.',                     'Railings, mullions, curtain panels — a hierarchy the flat eav cannot encode.'),
  (4,  'DEFINES',          'node',            'geometry', 'live',     'rvextract,nwextract', NULL,      'DEFINITION → shared geometry.',                   'The instancing contract: one mesh owned by a definition, reused by placements.'),
  (5,  'HAS_MATERIAL',     'geometry',        'node',     'live',     'rvextract,nwextract', NULL,      'Geometry → MATERIAL node.',                       'Base render appearance (full PBR).'),
  (6,  'HAS_COLOR',        'geometry|object', 'node',     'live',     'managed',             NULL,      'Geometry/object → COLOR node.',                   'Colour override — kept distinct from HAS_MATERIAL because it drives a different viewer render mode.'),
  (7,  'ON_LEVEL',         'object',          'node',     'live',     'rvextract,nwextract', NULL,      'Object → LEVEL node.',                            'Storey membership; also the default scene-view tier.'),
  (8,  'DISPLAY_INSTANCE', 'object',          'node',     'live',     'rvextract,nwextract', 'ordinal', 'Object → INSTANCE node (top level).',             'Place a definition here with a transform.'),
  (9,  'DEFINES_INSTANCE', 'node',            'node',     'live',     'rvextract',           'ordinal', 'DEFINITION → nested INSTANCE node.',              'Nested instancing — a definition that itself contains placed instances.'),
  (10, 'IN_COLLECTION',    'object',          'node',     'live',     'managed',             NULL,      'Object → CONTAINER(Collection).',                 'Authored layer/collection-tree membership.'),
  (11, 'IN_MODEL',         'object',          'node',     'live',     'nwextract',           NULL,      'Object → CONTAINER(Model).',                      'Federation tier (source-file grouping); outermost scene-view tier when >1 model.'),
  (12, 'IN_ROOM',          'object',          'object',   'live',     'rvextract',           NULL,      'Object → containing room object.',                'Spatial occupancy (furniture/door/window → room). Rooms are objects, not nodes.'),
  (13, 'IN_SPACE',         'object',          'object',   'live',     'rvextract',           NULL,      'Object → containing MEP space object.',           'Spatial occupancy for building services (terminal/fixture/equipment → MEP Space). Spaces are objects, not nodes — mirror of IN_ROOM. Un-retired post-v5: the v5 rationale was wrong — ODA getRoomId(Room) returns the containing OdBmRoomElem whose getSpatialElementType() distinguishes Space from Room (verified against the legacy converter and the objects_R26 fixture).'),
  (14, 'IN_SYSTEM',        'object',          'node',     'live',     'rvextract,nwextract', NULL,      'Object → CONTAINER(MEP System | Network).',       'MEP grouping membership. Carries BOTH authored Revit systems and derived Navis networks — the container subtype distinguishes them (the IN_NETWORK collapse).'),
  (15, 'IN_NETWORK',       NULL,              NULL,       'retired',  NULL,                  NULL,      'Object → derived MEP network.',                   'Retired in v5: collapsed into IN_SYSTEM (subtype=Network).'),
  (16, 'IN_LINE',          NULL,              NULL,       'retired',  NULL,                  NULL,      'Object → civil alignment/line.',                  'Retired in v5: never emitted; reintroduce if/when a producer needs it.'),
  (17, 'IN_GROUP',         'object',          'node',     'live',     'managed',             NULL,      'Object → CONTAINER(Group).',                      'Authored scene-group membership (Rhino/AutoCAD groups). A separate axis from IN_COLLECTION: an object keeps its layer AND its group(s); groups may nest (CONTAINER def_ref) and overlap. Un-retired post-v5.'),
  (18, 'IN_ASSEMBLY',      NULL,              NULL,       'retired',  NULL,                  NULL,      'Object → assembly.',                              'Retired in v5: never emitted.'),
  (19, 'IN_SUBASSEMBLY',   NULL,              NULL,       'retired',  NULL,                  NULL,      'Object → subassembly.',                           'Retired in v5: never emitted.'),
  (20, 'XREF',             NULL,              NULL,       'retired',  NULL,                  NULL,      'External reference link.',                        'Retired in v5: never emitted.'),
  (21, 'CONNECTS_TO',      'object',          'object',   'live',     'rvextract,nwextract', 'scope',   'Object → object connectivity (directed).',        'The connectivity graph. ord scopes it: system-K (MEP flow), opening-K (room adjacency), 0 (Navis port-cluster / unscoped).'),
  (22, 'HOSTED_ON',        NULL,              NULL,       'retired',  NULL,                  NULL,      'Hosted element → host.',                          'Retired in v5 (deferred): clean ODA getHost exists — reintroduce when the host/hosted edge is needed.'),
  (23, 'BOUNDS',           'object',          'object',   'live',     'rvextract',           NULL,      'Bounding wall → room object.',                    'Room footprint (which walls bound a room) for downstream egress / plan analysis.');

-- ── node_kinds ───────────────────────────────────────────────────────────────
CREATE TABLE node_kinds (
  id             INTEGER PRIMARY KEY,
  name           VARCHAR NOT NULL,
  status         VARCHAR NOT NULL,
  columns        VARCHAR,      -- csv of nodes.* columns this kind populates
  subtype_values VARCHAR,      -- csv (CONTAINER only)
  description    VARCHAR,
  why            VARCHAR
);
INSERT INTO node_kinds
  (id, name,         status,    columns,                                  subtype_values,                       description, why) VALUES
  (1, 'DEFINITION',  'live',    'name,def_ref',                           NULL,                                 'Shared geometry template.',          'Target of DEFINES; reused by many placements.'),
  (2, 'INSTANCE',    'live',    'transform,units,def_ref',                NULL,                                 'A placement / occurrence.',          'Carries the composed transform; bulk-scanned on load.'),
  (3, 'MATERIAL',    'live',    'argb,opacity,metalness,roughness',       NULL,                                 'Full-PBR render asset.',             'Target of HAS_MATERIAL.'),
  (4, 'COLOR',       'live',    'argb,opacity',                           NULL,                                 'Raw colour override.',               'Target of HAS_COLOR; a SEPARATE viewer render mode from MATERIAL (an object can carry both).'),
  (5, 'LEVEL',       'live',    'name,elevation',                         NULL,                                 'A storey.',                          'Target of ON_LEVEL; elevation drives architectural ordering.'),
  (6, 'COLLECTION',  'retired', NULL,                                     NULL,                                 'Authored layer/collection node.',    'Retired in v5: folded into CONTAINER (subtype=Collection).'),
  (7, 'CONTAINER',   'live',    'name,def_ref,subtype',                   'Collection,Model,MEP System,Network,Group','Polymorphic grouping tree.',         'The single grouping node; subtype is its only discriminator. Targets of IN_COLLECTION / IN_MODEL / IN_SYSTEM / IN_GROUP.');

-- ── bundle_files (the manifest) ──────────────────────────────────────────────
--   sharded   : true ⇒ the table rolls across multiple parquet files; read via read_glob.
--   file_glob : the glob a consumer reads (= the single file for unsharded tables).
-- Sharding scheme (geometries): shard 0 keeps the canonical name
--   `{base}.geometries.parquet` (a model that fits one shard is byte-identical to the
--   pre-sharding output); overflow shards are `{base}.geometries.{N}.parquet` (N=1,2,…);
--   the producer rolls BEFORE a blob would exceed the shard cap. Always read the SET.
CREATE TABLE bundle_files (
  ord             INTEGER,
  name            VARCHAR,   -- logical (attached view) name
  file_pattern    VARCHAR,   -- canonical / shard-0 file (always present if the table is)
  file_glob       VARCHAR,   -- what the consumer actually reads
  sharded         BOOLEAN,
  required        BOOLEAN,
  self_describing BOOLEAN,   -- a catalog the consumer can read with no prior knowledge
  description     VARCHAR
);
INSERT INTO bundle_files VALUES
  (1,  'objects',     '{base}.eav.objects.parquet',         '{base}.eav.objects.parquet',         false, true,  false, 'Object identity registry.'),
  (2,  'paths',       '{base}.eav.paths.parquet',           '{base}.eav.paths.parquet',           false, true,  false, 'Shared attribute-name dictionary.'),
  (3,  'eav',         '{base}.eav.eav.parquet',             '{base}.eav.eav.parquet',             false, true,  false, 'Per-object flattened attributes.'),
  (4,  'types',       '{base}.eav.types.parquet',           '{base}.eav.types.parquet',           false, false, false, 'Deduped type / shared-parameter groups.'),
  (5,  'type_eav',    '{base}.eav.type_eav.parquet',        '{base}.eav.type_eav.parquet',        false, false, false, 'Type-scoped attributes.'),
  (6,  'object_type', '{base}.eav.object_type.parquet',     '{base}.eav.object_type.parquet',     false, false, false, 'Object → type weak references.'),
  (7,  'nodes',       '{base}.envelope.nodes.parquet',      '{base}.envelope.nodes.parquet',      false, true,  false, 'Synthetic graph nodes.'),
  (8,  'relations',   '{base}.envelope.relations.parquet',  '{base}.envelope.relations.parquet',  false, true,  false, 'Typed graph edges.'),
  (9,  'rel_types',   '{base}.envelope.rel_types.parquet',  '{base}.envelope.rel_types.parquet',  false, true,  true,  'Self-describing relation catalog.'),
  (10, 'node_kinds',  '{base}.envelope.node_kinds.parquet', '{base}.envelope.node_kinds.parquet', false, true,  true,  'Self-describing node-kind catalog.'),
  (11, 'meta',        '{base}.envelope.meta.parquet',       '{base}.envelope.meta.parquet',       false, true,  true,  'schema_version + producer.'),
  (12, 'scene_views', '{base}.envelope.scene_views.parquet','{base}.envelope.scene_views.parquet',false, false, true,  'Producer-authored default projection.'),
  (13, 'geometries',  '{base}.geometries.parquet',          '{base}.geometries*.parquet',         true,  true,  false, 'SGEO mesh blobs (content-hash deduped). SHARDED: shard 0 = {base}.geometries.parquet, overflow = {base}.geometries.{N}.parquet; read the glob.'),
  (14, 'camera_views','{base}.envelope.camera_views.parquet','{base}.envelope.camera_views.parquet',false, false, true, 'Named camera viewpoints (eye/forward/up + projection).');
