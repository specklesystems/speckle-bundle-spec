-- ════════════════════════════════════════════════════════════════════════════
--  Speckle bundle format — SINGLE SOURCE OF TRUTH   (schema_version 1.1.0)
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
-- Reference point (ENG-8947 → ENG-9099): producers that RE-BASE geometry by a source
-- reference point (Revit project base / survey point / shared coordinates) record it as
-- MODEL-scoped eav rows in the `model` file (17), NOT here: `referencePoint.kind`
-- (projectBasePoint | surveyPoint | sharedCoordinates | internalOriginFallback),
-- `referencePoint.transform` (the FULL rigid transform applied — 16 row-major doubles,
-- InstanceProxy layout) and `referencePoint.units`. "internalOriginFallback" = a reference
-- point was REQUESTED but missing from the model; the producer converted at the internal
-- origin (no transform row) — recorded degradation, not silence. No rows = internal origin.
-- The former meta columns reference_point_kind/_offset are REMOVED (xyz-only offsets lost
-- rotation and meta is the wrong home for model data); consumers tolerate them as extra
-- columns on old bundles but must not read them.
--
-- produced_by/producer_version: the slug and version of the producer of this model version
-- sdk_name/sdk_version: name and version of the SDK used to author this version
-- migrated_from_schema_version: for older migrated models, the original schema version, null for non-migrated models.
-- schema_version is the semver of this spec (== package.json version) so one string, not two numbers, names the vocabulary.
CREATE TABLE meta (schema_version VARCHAR, produced_by VARCHAR,
                   producer_version VARCHAR, sdk_name VARCHAR, sdk_version VARCHAR, migrated_from_schema_version INTEGER);
INSERT INTO meta VALUES ('1.1.0', 'speckle-bundle-spec', NULL, NULL, NULL, NULL);
COMMENT ON COLUMN meta.schema_version IS 'Semver of the spec this bundle was written against; equals the speckle-bundle-spec package version.';

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
  emissive  INTEGER,
  ior       DOUBLE,
  elevation DOUBLE,
  gh_topology  VARCHAR
);
COMMENT ON TABLE nodes IS 'Synthetic graph nodes. Bounded STRUCTURAL scaffolding (fixed columns) — unbounded/source-variable metadata belongs on objects (eav), never here. Add a column only for a genuinely new structural scalar.';
COMMENT ON COLUMN nodes.id IS 'Dense int K (the node K-space, distinct from object_index). Overlaps geometry K numerically — disambiguate by the rel''s namespaces.';
COMMENT ON COLUMN nodes.kind IS 'NodeKind discriminator (see node_kinds catalog).';
COMMENT ON COLUMN nodes.def_ref IS 'Node→node K reference: INSTANCE→DEFINITION, or CONTAINER→parent container (tree nesting).';
COMMENT ON COLUMN nodes.transform IS 'INSTANCE only. Row-major 4x4 as CSV. HOT: bulk-scanned per instance (100k–1M) on load — must stay columnar.';
COMMENT ON COLUMN nodes.units IS 'INSTANCE placement units; read in the same hot scan as transform.';
COMMENT ON COLUMN nodes.subtype IS 'CONTAINER polymorphism: Collection | Model | MEP System | Network. The single grouping discriminator (replaced the former units-overload).';
COMMENT ON COLUMN nodes.argb IS 'MATERIAL/COLOR packed colour.';
COMMENT ON COLUMN nodes.emissive IS 'MATERIAL packed emissive colour (ARGB). NULL = no emission (producers normalize black RGB to NULL); consumers default NULL to black [ENG-8791].';
COMMENT ON COLUMN nodes.ior IS 'MATERIAL index of refraction (PBR scalar, typically 1.0–2.5); NULL = unset [ENG-8791].';
COMMENT ON COLUMN nodes.elevation IS 'LEVEL height — lets the scene tree order storeys architecturally.';
COMMENT ON COLUMN nodes.gh_topology IS 'Grasshopper collection topologies. i.e. 0-1 0;0-1 to keep them as source on receive.';

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

-- ── structural_results (optional, per-domain purpose file) ───────────────────
--  Long/tidy analysis + design results. One scalar per row; columns are ORTHOGONAL
--  AXES and each result type lights up only the axes it has (unused = NULL). Rule:
--  one file PER ANALYSIS DOMAIN, shared by every producer in it (ETABS/CSi/SAP/TSD
--  all write THIS schema); a non-structural domain (environmental/energy) gets its
--  own eav.{domain}-results.parquet rather than overloading these axes. Kept OUT of
--  eav.eav (whose single (object,path,value) triple can't hold case/station/step
--  without exploding the shared path dictionary). Additive nullable columns are safe
--  to add later; renaming/retyping is not — see docs/rationale/structural-results.md.
CREATE TABLE structural_results (
  object_index   INTEGER,           -- object-level identity → objects.object_index; NULL for group/model-level
  element_name   VARCHAR,           -- group-level identity (pier/spandrel name — a named group, not an interned object); NULL otherwise
  location       VARCHAR,           -- model/story-level identity (story name; blank = whole model); NULL for object-level
  result_type    VARCHAR NOT NULL,  -- frameForce | jointReaction | baseReaction | modalPeriod | pierForce | spandrelForce | storyDrift | storyForce | (TSD) memberForce | utilization | designCheck
  load_case      VARCHAR NOT NULL,  -- load case / combo / mode name (Dead, EQx, Modal)
  component      VARCHAR NOT NULL,  -- the quantity (P,V2,V3,T,M2,M3 | F1..M3 | FX..MZ | Period | drift | axial,majorShear,… | ratio | status)
  position_label VARCHAR,           -- CATEGORICAL position/direction that isn't a numeric station: Top/Bottom (pier/spandrel/story force), X/Y (story drift)
  station        DOUBLE,            -- NUMERIC position along a member (frame ElmSta); NULL for point/group/model results
  step           INTEGER,           -- time-history step / mode index; NULL or 1 for a static case
  value          DOUBLE,            -- the numeric result
  value_text     VARCHAR            -- non-numeric verdict (TSD PASS/FAIL). Exactly one of value / value_text is set per row
);
COMMENT ON TABLE structural_results IS 'Optional per-domain purpose file: structural analysis + design results in long/tidy form. Three identity shapes: object-level (object_index set), group-level (element_name set, e.g. a pier = named wall group), model/story-level (both NULL; identity is location/step). Opt-in — emitted only when the user selected cases + result types AND the model is locked (analysis run); a results failure is logged + skipped so geometry/properties still send.';
COMMENT ON COLUMN structural_results.object_index IS 'Object-level results only (frame/joint) → objects.object_index. Piers/spandrels are NOT interned objects (named groups of walls) → NULL, identity via element_name.';
COMMENT ON COLUMN structural_results.position_label IS 'Categorical position/direction (Top/Bottom, X/Y). Distinct from the numeric member station.';
COMMENT ON COLUMN structural_results.value_text IS 'Exactly one of value (numeric) / value_text (verdict) is set; consumer coalesces. value_text is NULL for all analysis results.';

-- ── property_set_definitions (optional, AEC property-set SCHEMAS) ─────────────
--  The definitions (SHAPE) of AEC/Civil3D property sets: one row per (set, field).
--  VALUES stay per-object in eav (path `properties.Property Sets.{set}.{field}`,
--  with unit + internal_definition_name = field_id) and attachment is DERIVED:
--  an object implements a set iff it carries value rows under it. Deliberately
--  NOT type_eav — type_eav rows are VALUES an object inherits as its own
--  attributes; schema rows there would surface as fake properties in the
--  documented eav ∪ type_eav read. Replaces the managed carrier pseudo-object
--  (application_id 'speckle:civil3d:property-set-definitions'). Receive ladder:
--  this file → carrier object (old managed bundles) → synthesize minimal defs
--  from the value rows themselves (name=path leaf, type=set value column,
--  unit/bucket-id from the eav row).
CREATE TABLE property_set_definitions (
  set_name        VARCHAR NOT NULL,
  set_key         VARCHAR NOT NULL,
  set_description VARCHAR,
  field_name      VARCHAR NOT NULL,
  field_bucket_id VARCHAR,
  data_type       VARCHAR,
  default_string  VARCHAR,
  default_double  DOUBLE,
  default_boolean BOOLEAN,
  unit            VARCHAR,
  description     VARCHAR,
  applies_to      VARCHAR
);
COMMENT ON TABLE property_set_definitions IS 'Optional schema catalog: AEC/Civil3D property-set definitions, one row per (set, field). ROW ORDER IS FIELD ORDER (the authored palette order — recreate preserves it). Values live in eav; attachment is derived from value paths. Set-level columns (set_name/set_key/set_description/applies_to) repeat on every row of the set — tidy-form denormalization, same as structural_results.';
COMMENT ON COLUMN property_set_definitions.set_name IS 'Authored definition name (''Pipe Data'') — the key the eav value paths carry (properties.Property Sets.{set_name}.*), so it is the first hop of the rebind join.';
COMMENT ON COLUMN property_set_definitions.set_key IS 'Content hash of the definition (name + ordered field tuples; recipe must be byte-identical across producers). SET-level identity: C3D allows two same-named set definitions — set_key keeps their rows apart in this file and dedupes identical schemas across merged bundles. Value rows cannot carry it (paths have only the name); rebind disambiguates same-named sets by field_bucket_id membership.';
COMMENT ON COLUMN property_set_definitions.set_description IS 'The SET''s own authored description (PropertySetDefinition.Description) — distinct from the per-field description.';
COMMENT ON COLUMN property_set_definitions.field_bucket_id IS 'The field''s FieldBucketId — the SAME string the value rows ship in eav.internal_definition_name, so this is THE rebind join key (field-scoped: unique within its set only). NULL when the producer could not observe it (definition never attached to a sent object) — rebind falls back to matching field_name against the value path leaf.';
COMMENT ON COLUMN property_set_definitions.data_type IS 'Host datatype enum as text (Real | Text | Integer | TrueFalse | List | …) — faithful recreate without inferring from values.';
COMMENT ON COLUMN property_set_definitions.default_string IS 'At most ONE of default_string / default_double / default_boolean is set (the eav exactly-one-value convention); all NULL = no default.';
COMMENT ON COLUMN property_set_definitions.unit IS 'Autodesk unit DISPLAY text (UnitType.GetTypeDisplayName), ''(none)'' filtered to NULL — same source and caveat as the value rows'' unit.';
COMMENT ON COLUMN property_set_definitions.description IS 'The FIELD''s authored description.';
COMMENT ON COLUMN property_set_definitions.applies_to IS 'Csv of host entity-type filters the set applies to; NULL = apply-to-all (or producer could not capture it).';

-- ── model (optional, model/document-scoped attributes) ────────────────────────
--  Attributes of the MODEL itself — Revit/Civil3D/Grasshopper document settings,
--  project information — facts with no owning object. Object-less eav rows:
--  exactly one value column set, unit rides per row. Path is inlined (not
--  interned via paths): the table is tiny and stays self-contained.
CREATE TABLE model (
  path          VARCHAR NOT NULL,
  value_string  VARCHAR,
  value_double  DOUBLE,
  value_boolean BOOLEAN,
  unit          VARCHAR
);
COMMENT ON TABLE model IS 'Optional model/document-scoped attributes (object-less eav): exactly one of value_string/value_double/value_boolean per row; consumer coalesces.';

-- ════════════════════════════════════════════════════════════════════════════
--  PART 2 — semantic catalogs (data). These tables carry the vocabulary AND its
--  meaning. rel_types / node_kinds also SHIP in the bundle (a consumer may read
--  them at runtime); the extra semantic columns make a bundle self-documenting.
-- ════════════════════════════════════════════════════════════════════════════

-- ── rel_types ────────────────────────────────────────────────────────────────
--   status        : live | reserved | retired
--   src_ns/dst_ns : object | node | geometry | 'geometry|object' (null when retired)
--   ord_semantics : ordinal | scope | (null)
--   rel           : deployed parquet key; code generators alias it to id internally
CREATE TABLE rel_types (
  rel           INTEGER PRIMARY KEY,
  name          VARCHAR NOT NULL,
  src_ns        VARCHAR,
  dst_ns        VARCHAR,
  status        VARCHAR NOT NULL,
  emitted_by    VARCHAR,      -- csv of producers: rvextract | nwextract | dwgextract | dgnextract | skpextract | teklaextract | managed
  ord_semantics VARCHAR,
  description   VARCHAR,
  why           VARCHAR
);
INSERT INTO rel_types
  (rel, name,              src_ns,            dst_ns,     status,     emitted_by,            ord_semantics, description, why) VALUES
  (1,  'DISPLAY',          'object',          'geometry', 'live',     'rvextract,dwgextract,dgnextract,skpextract,teklaextract,managed', 'ordinal', 'Object → its own mesh.',                          'Top-level direct meshes (walls, in-place). Navis never uses it — everything there is an instance.'),
  (2,  'SOLID',            'object',          'geometry', 'live',     'dwgextract,managed',  'ordinal', 'Solid body, distinct from a display mesh.',       'Rhino/Civil3D ship true solids beside tessellated display meshes; within a definition member, receive prefers the solid over its meshes.'),
  (3,  'SUBELEMENT',       'object',          'object',   'live',     'rvextract,dwgextract,teklaextract,managed', 'ordinal', 'Parent → child containment.',                     'Railings, mullions, curtain panels — a hierarchy the flat eav cannot encode.'),
  (4,  'DEFINES',          'node',            'geometry', 'live',     'rvextract,nwextract,dwgextract,dgnextract,skpextract,teklaextract,managed', 'ordinal', 'DEFINITION → shared geometry.',                   'The instancing contract: one mesh owned by a definition, reused by placements. ord is the MEMBER ordinal: rows sharing (definition, ord) are one member''s geometries (e.g. a solid + its display meshes) and join to DEFINES_MEMBER on the same key.'),
  (5,  'HAS_MATERIAL',     'geometry',        'node',     'live',     'rvextract,nwextract,dwgextract,dgnextract,skpextract,teklaextract,managed', NULL, 'Geometry → MATERIAL node.',                       'Base render appearance (full PBR). src is geometry ONLY (union removed post-v5): placement paint lives on OBJECT_HAS_MATERIAL (26). Pre-split bundles may still carry INSTANCE srcs tagged ord=1 (ENG-8849 era) — consumers keep the geometry-first fallback.'),
  (6,  'HAS_COLOR',        'geometry',        'node',     'live',     'dwgextract,dgnextract,skpextract,managed', NULL, 'Geometry → COLOR node.',                          'Display colour — kept distinct from HAS_MATERIAL because it drives a different viewer render mode. src is geometry ONLY (union removed post-v5): object-plane colour lives on OBJECT_HAS_COLOR (27). Pre-split bundles may still carry object srcs.'),
  (7,  'ON_LEVEL',         'object',          'node',     'live',     'rvextract,nwextract,managed', NULL, 'Object → LEVEL node.',                            'Storey membership; also the default scene-view tier.'),
  (8,  'DISPLAY_INSTANCE', 'object',          'node',     'live',     'rvextract,nwextract,dwgextract,dgnextract,skpextract,teklaextract,managed', 'ordinal', 'Object → INSTANCE node (top level).',             'Place a definition here with a transform. STRICTLY a render contract — every edge is a world-space render root. For the object↔placement association WITHOUT rendering (definition members) use PLACES (24); overloading this rel would draw members untransformed at the origin on deployed consumers [ENG-8782].'),
  (9,  'DEFINES_INSTANCE', 'node',            'node',     'live',     'rvextract,dwgextract,skpextract,managed', 'ordinal', 'DEFINITION → nested INSTANCE node.',              'Nested instancing — a definition that itself contains placed instances. ord shares the definition''s SINGLE member-ordinal space with DEFINES (4) and DEFINES_MEMBER (25) — one authored sequence numbers all members, geometry and nested-instance alike, so interleaved member order round-trips.'),
  (10, 'IN_COLLECTION',    'object',          'node',     'live',     'nwextract,dwgextract,dgnextract,skpextract,managed', NULL, 'Object → CONTAINER(Collection).',                 'Authored layer/collection-tree membership.'),
  (11, 'IN_MODEL',         'object',          'node',     'live',     'rvextract,nwextract,dgnextract,managed', NULL, 'Object → CONTAINER(Model).',                      'Federation tier (source-file grouping); outermost scene-view tier when >1 model.'),
  (12, 'IN_ROOM',          'object',          'object',   'live',     'rvextract,managed',   NULL,      'Object → containing room object.',                'Spatial occupancy (furniture/door/window → room). Rooms are objects, not nodes.'),
  (13, 'IN_SPACE',         NULL,              NULL,       'retired',  NULL,                  NULL,      'Object → containing MEP space.',                  'Retired in v5: ODA exposes no element→space membership (getRoomId only). Spaces ship as objects with eav.'),
  (14, 'IN_SYSTEM',        'object',          'node',     'live',     'rvextract,nwextract,dwgextract,managed', NULL, 'Object → CONTAINER(MEP System | Network).',       'MEP grouping membership. Carries BOTH authored Revit systems and derived Navis networks — the container subtype distinguishes them (the IN_NETWORK collapse).'),
  (15, 'IN_NETWORK',       NULL,              NULL,       'retired',  NULL,                  NULL,      'Object → derived MEP network.',                   'Retired in v5: collapsed into IN_SYSTEM (subtype=Network).'),
  (16, 'IN_LINE',          NULL,              NULL,       'retired',  NULL,                  NULL,      'Object → civil alignment/line.',                  'Retired in v5: never emitted; reintroduce if/when a producer needs it.'),
  (17, 'IN_GROUP',         'object',          'node',     'live',     'rvextract,dwgextract,managed', NULL, 'Object → CONTAINER(Group).',                      'Authored scene-group membership (Rhino/AutoCAD groups). A separate axis from IN_COLLECTION: an object keeps its layer AND its group(s); groups may nest (CONTAINER def_ref) and overlap. Un-retired post-v5.'),
  (18, 'IN_ASSEMBLY',      'object',          'object',   'live',     'teklaextract',        'ordinal', 'Member object → containing assembly object.',    'Authored fabrication membership, separate from SUBELEMENT ownership. ord=0 is the main member; ord>=1 orders secondary or nested-assembly members.'),
  (19, 'IN_SUBASSEMBLY',   NULL,              NULL,       'retired',  NULL,                  NULL,      'Object → subassembly.',                           'Retired in v5: never emitted.'),
  (20, 'XREF',             NULL,              NULL,       'retired',  NULL,                  NULL,      'External reference link.',                        'Retired in v5: never emitted.'),
  (21, 'CONNECTS_TO',      'object',          'object',   'live',     'rvextract,nwextract,dwgextract,teklaextract,managed', 'scope', 'Object → object connectivity (directed).',        'The connectivity graph. ord scopes it: system-K (MEP flow), opening-K (room adjacency), 0 (Navis port-cluster / unscoped).'),
  (22, 'HOSTED_ON',        'object',          'object',   'live',     'rvextract,teklaextract,managed', NULL, 'Hosted element → host.',                          'Revit hosting (door/window → wall, fixture → ceiling/floor/face) from ODA getHostId. A DIFFERENT semantic from SUBELEMENT ownership (owningElemId): a door is placed on a wall, not a component of it. Emitted only when the element has no owner (legacy precedence) and both endpoints are converted. Un-retired post-v5.'),
  (23, 'BOUNDS',           'object',          'object',   'live',     'rvextract',           NULL,      'Bounding element → room object.',                 'The room envelope, for downstream egress / plan analysis. BOTH halves, undifferentiated: the plan perimeter (walls, columns, room separation lines — Revit computes these in 2D at the room''s computation height) and the horizontal caps (floors, ceilings, roofs). Filter the src object by category for the plan-only footprint.'),
  (24, 'PLACES',           'object',          'node',     'live',     'managed',             NULL,      'Member object → its INSTANCE node (association only).', 'The object↔node map for one source thing split across both planes. Ties a render-edge-less definition-member object to its nested placement so its properties and IN_COLLECTION stay reachable; replaces the @speckle.instance_k eav stamp [ENG-9110]. NEVER a render root — that is DISPLAY_INSTANCE.'),
  (25, 'DEFINES_MEMBER',   'node',            'object',   'live',     'managed',             'ordinal', 'DEFINITION → member object.',                     'Definition membership on the OBJECT plane, where nothing is deduped — emitted for EVERY member, geometry and nested-instance alike. ord is THE member ordinal: one authored sequence per definition, shared with DEFINES (4) and DEFINES_INSTANCE (9), so interleaved member order round-trips. A geometry member''s content is its DEFINES rows joined on (definition, ord) — dedup-safe even when content-hashing collapses identical meshes across definitions; an instance member''s placement is its PLACES edge. Replaces the @speckle.geometry_k eav stamp.'),
  (26, 'OBJECT_HAS_MATERIAL','object',        'node',     'live',     'managed',             NULL,      'Object → MATERIAL node (placement paint).',       'Placement painting on the object plane (SketchUp instance painting, ENG-8849 — formerly HAS_MATERIAL''s INSTANCE src / the ord=1 stamp). FILL semantics: geometry-level HAS_MATERIAL always wins; the object''s material fills definition geometry with no material of its own, resolved down the placement chain (a nested member object reaches its placement via PLACES). NOTE: OBJECT_HAS_COLOR (27) deliberately INVERTS this precedence — material is intrinsic, colour is presentational.'),
  (27, 'OBJECT_HAS_COLOR', 'object',          'node',     'live',     'managed',             NULL,      'Object → COLOR node (object-plane colour).',      'Object-plane colour (formerly HAS_COLOR''s object src). OVERRIDE semantics — deliberately the INVERSE of OBJECT_HAS_MATERIAL: material is intrinsic (geometry owns, object fills), colour is presentational (object overrides, geometry is the default). Deployed receives already resolve object colour last-write-wins over geometry colour, and this rel''s own use cases — per-object colour on deduped twin meshes, clash/status highlighting, CAD ByBlock-style inheritance — only work when the object wins. Resolution: object > geometry > NODE_HAS_COLOR (container default) > none.'),
  (28, 'NODE_HAS_MATERIAL','node',            'node',     'live',     'managed',             NULL,      'Node → MATERIAL node (container appearance).',    'The authored layer/tag render material (Rhino layer material, AutoCAD/Civil3D layer material, SketchUp tag material) — the assignment receivers restore on the rebuilt container, which the member-geometry flatten [ENG-9108] erased before this rel existed. Weakest tier of the material ladder (FILL semantics, rel 26): geometry HAS_MATERIAL wins, then OBJECT_HAS_MATERIAL, then the container''s NODE_HAS_MATERIAL reached via the object''s membership edge (IN_COLLECTION). Producers keep flattening the inherited material onto member geometry so render-only consumers never need the ladder walk; this edge carries the authored source of that flatten.'),
  (29, 'NODE_HAS_COLOR',   'node',            'node',     'live',     'managed',             NULL,      'Node → COLOR node (container display colour).',   'Layer/tag display colour as a first-class edge, the colour twin of NODE_HAS_MATERIAL and — like it — the weakest tier: colour resolves object > geometry > container (the container edge is the ByLayer default that applies when nothing more specific does, so OBJECT_HAS_COLOR''s override precedence, rel 27, is untouched). Supersedes the argb managed producers stamped directly on CONTAINER rows — an undocumented carrier; consumers prefer this edge and keep reading CONTAINER argb as the fallback for older bundles.'),
  (30, 'CENTERLINE',       'object',          'geometry', 'live',     'managed',             'ordinal', 'Object → its centerline / axis.', 'The axis a run or member follows, distinct from the shell that renders it. Downstream routing, length take-off, clash lines and single-line drawings all need the curve, not the tessellated tube. TWO SHAPES, both under one rel because a consumer asking "where is the axis" does not care which: (a) the element''s own authored location curve, for anything placed along a curve — a duct, pipe, conduit or tray IS its centerline, and a framing member''s axis is the same datum; (b) for a point-placed MEP fitting (elbow, tee, cross, transition), which has no location curve at all, ONE SEGMENT PER CONNECTOR from the connector to the fitting''s node — what a single-line drawing draws, and the only shape that survives a branch, where no single curve can. ord is the branch index, so (b) is multi-valued and ordered. CAVEAT on (a): for some families the authored curve is not literally the centre — a Revit wall''s location line follows its Location Line type parameter and may be a core or finish face. STRICTLY NOT a render edge, which is why it is its own rel rather than a role on DISPLAY (1): a consumer drawing every geometry-target rel would draw the axis through the middle of the duct.');

-- ── node_kinds ───────────────────────────────────────────────────────────────
-- Physical key name matches nodes.kind and the deployed parquet catalog.
CREATE TABLE node_kinds (
  kind           INTEGER PRIMARY KEY,
  name           VARCHAR NOT NULL,
  status         VARCHAR NOT NULL,
  columns        VARCHAR,      -- csv of nodes.* columns this kind populates
  subtype_values VARCHAR,      -- csv (CONTAINER only)
  description    VARCHAR,
  why            VARCHAR
);
INSERT INTO node_kinds
  (kind, name,       status,    columns,                                  subtype_values,                       description, why) VALUES
  (1, 'DEFINITION',  'live',    'name,def_ref',                           NULL,                                 'Shared geometry template.',          'Target of DEFINES; reused by many placements.'),
  (2, 'INSTANCE',    'live',    'transform,units,def_ref',                NULL,                                 'A placement / occurrence.',          'Carries the composed transform; bulk-scanned on load.'),
  (3, 'MATERIAL',    'live',    'name,argb,opacity,metalness,roughness,emissive,ior', NULL,                     'Full-PBR render asset.',             'Target of HAS_MATERIAL. name is the authored host material name (nullable) — receivers recreate the host material under it instead of a colour-derived placeholder. emissive/ior complete the universal PBR scalar set [ENG-8791].'),
  (4, 'COLOR',       'live',    'argb,opacity',                           NULL,                                 'Raw colour override.',               'Target of HAS_COLOR; a SEPARATE viewer render mode from MATERIAL (an object can carry both).'),
  (5, 'LEVEL',       'live',    'name,elevation',                         NULL,                                 'A storey.',                          'Target of ON_LEVEL; elevation drives architectural ordering.'),
  (6, 'COLLECTION',  'retired', NULL,                                     NULL,                                 'Authored layer/collection node.',    'Retired in v5: folded into CONTAINER (subtype=Collection).'),
  (7, 'CONTAINER',   'live',    'name,def_ref,subtype,gh_topology',      'Collection,Layer,Folder,Model,MEP System,Network,Group','Polymorphic grouping tree.',         'The single grouping node; subtype is its only discriminator. Targets of IN_COLLECTION / IN_MODEL / IN_SYSTEM / IN_GROUP; src of NODE_HAS_MATERIAL / NODE_HAS_COLOR (layer/tag appearance).');

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
  (11, 'meta',        '{base}.envelope.meta.parquet',       '{base}.envelope.meta.parquet',       false, true,  true,  'schema_version + producer provenance.'),
  (12, 'scene_views', '{base}.envelope.scene_views.parquet','{base}.envelope.scene_views.parquet',false, false, true,  'Producer-authored default projection.'),
  (13, 'geometries',  '{base}.geometries.parquet',          '{base}.geometries*.parquet',         true,  true,  false, 'SGEO mesh blobs (content-hash deduped). SHARDED: shard 0 = {base}.geometries.parquet, overflow = {base}.geometries.{N}.parquet; read the glob.'),
  (14, 'camera_views','{base}.envelope.camera_views.parquet','{base}.envelope.camera_views.parquet',false, false, true, 'Named camera viewpoints (eye/forward/up + projection).'),
  (15, 'structural_results', '{base}.eav.structural_results.parquet', '{base}.eav.structural_results.parquet', false, false, false, 'OPTIONAL per-domain purpose file: structural analysis/design results (long/tidy scalar rows). Present only when a structural producer (ETABS/CSi/SAP/TSD) publishes results for a locked model.'),
  (16, 'property_set_definitions', '{base}.eav.property_set_definitions.parquet', '{base}.eav.property_set_definitions.parquet', false, false, false, 'OPTIONAL schema catalog: AEC property-set definitions (shape only — values stay in eav, attachment derived from value paths).'),
  (17, 'model', '{base}.eav.model.parquet', '{base}.eav.model.parquet', false, false, false, 'OPTIONAL model/document-scoped attributes (object-less eav rows: Revit/Civil3D/Grasshopper document settings, project info). Home of the reference-point record: referencePoint.kind/.transform/.units (see meta header comment).');
