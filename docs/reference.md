<!-- GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT. Run npm run generate. -->
# Speckle bundle format — reference (schema_version 5)

Generated from `spec/bundle-spec.sql`. Rationale & design history live in `docs/rationale/`.

## Relations (`rel_types`)

| id | name | src → dst | status | emitted by | ord | description / why |
|---|---|---|---|---|---|---|
| 1 | **DISPLAY** | object → geometry | 🟢 live | rvextract | ordinal | Object → its own mesh. — *Top-level direct meshes (walls, in-place). Navis never uses it — everything there is an instance.* |
| 2 | **SOLID** | object → geometry | 🟡 reserved | · | ordinal | Solid body, distinct from a display mesh. — *Reserved: Rhino/Civil3D will distinguish true solids from tessellated display meshes.* |
| 3 | **SUBELEMENT** | object → object | 🟢 live | rvextract | ordinal | Parent → child containment. — *Railings, mullions, curtain panels — a hierarchy the flat eav cannot encode.* |
| 4 | **DEFINES** | node → geometry | 🟢 live | rvextract,nwextract | · | DEFINITION → shared geometry. — *The instancing contract: one mesh owned by a definition, reused by placements.* |
| 5 | **HAS_MATERIAL** | geometry → node | 🟢 live | rvextract,nwextract | · | Geometry → MATERIAL node. — *Base render appearance (full PBR).* |
| 6 | **HAS_COLOR** | geometry\|object → node | 🟢 live | managed | · | Geometry/object → COLOR node. — *Colour override — kept distinct from HAS_MATERIAL because it drives a different viewer render mode.* |
| 7 | **ON_LEVEL** | object → node | 🟢 live | rvextract,nwextract | · | Object → LEVEL node. — *Storey membership; also the default scene-view tier.* |
| 8 | **DISPLAY_INSTANCE** | object → node | 🟢 live | rvextract,nwextract | ordinal | Object → INSTANCE node (top level). — *Place a definition here with a transform.* |
| 9 | **DEFINES_INSTANCE** | node → node | 🟢 live | rvextract | ordinal | DEFINITION → nested INSTANCE node. — *Nested instancing — a definition that itself contains placed instances.* |
| 10 | **IN_COLLECTION** | object → node | 🟢 live | managed | · | Object → CONTAINER(Collection). — *Authored layer/collection-tree membership.* |
| 11 | **IN_MODEL** | object → node | 🟢 live | nwextract | · | Object → CONTAINER(Model). — *Federation tier (source-file grouping); outermost scene-view tier when >1 model.* |
| 12 | **IN_ROOM** | object → object | 🟢 live | rvextract | · | Object → containing room object. — *Spatial occupancy (furniture/door/window → room). Rooms are objects, not nodes.* |
| 13 | **IN_SPACE** | object → object | 🟢 live | rvextract | · | Object → containing MEP space object. — *Spatial occupancy for building services (terminal/fixture/equipment → MEP Space). Spaces are objects, not nodes — mirror of IN_ROOM. Un-retired post-v5: the v5 rationale was wrong — ODA getRoomId(Room) returns the containing OdBmRoomElem whose getSpatialElementType() distinguishes Space from Room (verified against the legacy converter and the objects_R26 fixture).* |
| 14 | **IN_SYSTEM** | object → node | 🟢 live | rvextract,nwextract | · | Object → CONTAINER(MEP System \| Network). — *MEP grouping membership. Carries BOTH authored Revit systems and derived Navis networks — the container subtype distinguishes them (the IN_NETWORK collapse).* |
| 15 | **IN_NETWORK** | · | ⚪ retired | · | · | Object → derived MEP network. — *Retired in v5: collapsed into IN_SYSTEM (subtype=Network).* |
| 16 | **IN_LINE** | · | ⚪ retired | · | · | Object → civil alignment/line. — *Retired in v5: never emitted; reintroduce if/when a producer needs it.* |
| 17 | **IN_GROUP** | object → node | 🟢 live | managed | · | Object → CONTAINER(Group). — *Authored scene-group membership (Rhino/AutoCAD groups). A separate axis from IN_COLLECTION: an object keeps its layer AND its group(s); groups may nest (CONTAINER def_ref) and overlap. Un-retired post-v5.* |
| 18 | **IN_ASSEMBLY** | · | ⚪ retired | · | · | Object → assembly. — *Retired in v5: never emitted.* |
| 19 | **IN_SUBASSEMBLY** | · | ⚪ retired | · | · | Object → subassembly. — *Retired in v5: never emitted.* |
| 20 | **XREF** | · | ⚪ retired | · | · | External reference link. — *Retired in v5: never emitted.* |
| 21 | **CONNECTS_TO** | object → object | 🟢 live | rvextract,nwextract | scope | Object → object connectivity (directed). — *The connectivity graph. ord scopes it: system-K (MEP flow), opening-K (room adjacency), 0 (Navis port-cluster / unscoped).* |
| 22 | **HOSTED_ON** | · | ⚪ retired | · | · | Hosted element → host. — *Retired in v5 (deferred): clean ODA getHost exists — reintroduce when the host/hosted edge is needed.* |
| 23 | **BOUNDS** | object → object | 🟢 live | rvextract | · | Bounding wall → room object. — *Room footprint (which walls bound a room) for downstream egress / plan analysis.* |

## Node kinds (`node_kinds`)

| id | name | status | columns | subtypes | description / why |
|---|---|---|---|---|---|
| 1 | **DEFINITION** | 🟢 live | name,def_ref | · | Shared geometry template. — *Target of DEFINES; reused by many placements.* |
| 2 | **INSTANCE** | 🟢 live | transform,units,def_ref | · | A placement / occurrence. — *Carries the composed transform; bulk-scanned on load.* |
| 3 | **MATERIAL** | 🟢 live | argb,opacity,metalness,roughness | · | Full-PBR render asset. — *Target of HAS_MATERIAL.* |
| 4 | **COLOR** | 🟢 live | argb,opacity | · | Raw colour override. — *Target of HAS_COLOR; a SEPARATE viewer render mode from MATERIAL (an object can carry both).* |
| 5 | **LEVEL** | 🟢 live | name,elevation | · | A storey. — *Target of ON_LEVEL; elevation drives architectural ordering.* |
| 6 | **COLLECTION** | ⚪ retired | · | · | Authored layer/collection node. — *Retired in v5: folded into CONTAINER (subtype=Collection).* |
| 7 | **CONTAINER** | 🟢 live | name,def_ref,subtype | Collection,Model,MEP System,Network,Group | Polymorphic grouping tree. — *The single grouping node; subtype is its only discriminator. Targets of IN_COLLECTION / IN_MODEL / IN_SYSTEM / IN_GROUP.* |

## Bundle manifest (`bundle_files`)

| name | read glob | sharded | required | self-describing | description |
|---|---|---|---|---|---|
| `objects` | `{base}.eav.objects.parquet` | no | yes | no | Object identity registry. |
| `paths` | `{base}.eav.paths.parquet` | no | yes | no | Shared attribute-name dictionary. |
| `eav` | `{base}.eav.eav.parquet` | no | yes | no | Per-object flattened attributes. |
| `types` | `{base}.eav.types.parquet` | no | no | no | Deduped type / shared-parameter groups. |
| `type_eav` | `{base}.eav.type_eav.parquet` | no | no | no | Type-scoped attributes. |
| `object_type` | `{base}.eav.object_type.parquet` | no | no | no | Object → type weak references. |
| `nodes` | `{base}.envelope.nodes.parquet` | no | yes | no | Synthetic graph nodes. |
| `relations` | `{base}.envelope.relations.parquet` | no | yes | no | Typed graph edges. |
| `rel_types` | `{base}.envelope.rel_types.parquet` | no | yes | yes | Self-describing relation catalog. |
| `node_kinds` | `{base}.envelope.node_kinds.parquet` | no | yes | yes | Self-describing node-kind catalog. |
| `meta` | `{base}.envelope.meta.parquet` | no | yes | yes | schema_version + producer. |
| `scene_views` | `{base}.envelope.scene_views.parquet` | no | no | yes | Producer-authored default projection. |
| `geometries` | `{base}.geometries*.parquet` | yes | yes | no | SGEO mesh blobs (content-hash deduped). SHARDED: shard 0 = {base}.geometries.parquet, overflow = {base}.geometries.{N}.parquet; read the glob. |
| `camera_views` | `{base}.envelope.camera_views.parquet` | no | no | yes | Named camera viewpoints (eye/forward/up + projection). |

## Table shapes

### `camera_views`

| column | type | note |
|---|---|---|
| view | INTEGER | Dense ordinal, unique per row (the camera-view K-space; references nothing). |
| name | VARCHAR | Display label; consumer shows name ?? view. |
| is_default | BOOLEAN | Producer-nominated home/startup view. At most one row true. |
| ord | INTEGER | Display order in view menus. |
| pos_x | DOUBLE | Camera eye position, in `units` (model units — consumer scales like geometry). |
| pos_y | DOUBLE | · |
| pos_z | DOUBLE | · |
| forward_x | DOUBLE | View direction. UNIT VECTOR, unitless. Required — target is derivable as pos + forward. |
| forward_y | DOUBLE | · |
| forward_z | DOUBLE | · |
| up_x | DOUBLE | Camera up. UNIT VECTOR, unitless. |
| up_y | DOUBLE | · |
| up_z | DOUBLE | · |
| target_x | DOUBLE | Explicit look-at point, in `units`. Optional — null when the host has no real target (e.g. Revit). |
| target_y | DOUBLE | · |
| target_z | DOUBLE | · |
| units | VARCHAR | Units of pos/target/ortho_height/near/far. |
| is_ortho | BOOLEAN | True = parallel/orthographic projection; false = perspective. |
| fov | DOUBLE | VERTICAL field of view in DEGREES. Perspective only; null for ortho. |
| lens_mm | DOUBLE | 35mm-equivalent lens / focal length in millimetres (Rhino Camera35mmLensLength, SketchUp focal_length). Perspective only. |
| ortho_height | DOUBLE | Ortho view height, in `units`. Null for perspective. |
| aspect | DOUBLE | Frame aspect ratio (width/height), if the host has one. |
| near | DOUBLE | Near clipping distance, in `units`. |
| far | DOUBLE | Far clipping distance, in `units`. |

### `eav`

| column | type | note |
|---|---|---|
| object_index | INTEGER | · |
| path_index | INTEGER | · |
| value_string | VARCHAR | Exactly one of value_string/value_double/value_boolean is set; consumer coalesces. |
| value_double | DOUBLE | · |
| value_boolean | BOOLEAN | · |
| unit | VARCHAR | · |
| internal_definition_name | VARCHAR | · |

### `geometries`

| column | type | note |
|---|---|---|
| geometryIndex | INTEGER | · |
| content | BLOB | · |
| id | VARCHAR | · |
| type | VARCHAR | · |

### `nodes`

| column | type | note |
|---|---|---|
| id | INTEGER | Dense int K (the node K-space, distinct from object_index). Overlaps geometry K numerically — disambiguate by the rel's namespaces. |
| kind | INTEGER | NodeKind discriminator (see node_kinds catalog). |
| name | VARCHAR | · |
| def_ref | INTEGER | Node→node K reference: INSTANCE→DEFINITION, or CONTAINER→parent container (tree nesting). |
| transform | VARCHAR | INSTANCE only. Row-major 4x4 as CSV. HOT: bulk-scanned per instance (100k–1M) on load — must stay columnar. |
| units | VARCHAR | INSTANCE placement units; read in the same hot scan as transform. |
| subtype | VARCHAR | CONTAINER polymorphism: Collection \| Model \| MEP System \| Network. The single grouping discriminator (replaced the former units-overload). |
| argb | INTEGER | MATERIAL/COLOR packed colour. |
| opacity | DOUBLE | · |
| metalness | DOUBLE | · |
| roughness | DOUBLE | · |
| elevation | DOUBLE | LEVEL height — lets the scene tree order storeys architecturally. |

### `object_type`

| column | type | note |
|---|---|---|
| object_index | INTEGER | · |
| type_index | INTEGER | · |

### `objects`

| column | type | note |
|---|---|---|
| object_index | INTEGER | Dense int K (the object K-space). Relations with src_ns/dst_ns=object reference this. |
| application_id | VARCHAR | Source-stable id; the flat WorldTree node id IS this. |

### `paths`

| column | type | note |
|---|---|---|
| path_index | INTEGER | · |
| path | VARCHAR | · |

### `relations`

| column | type | note |
|---|---|---|
| rel | INTEGER | · |
| src | INTEGER | · |
| dst | INTEGER | · |
| ord | INTEGER | Dual-use: ORDINAL for ordered rels (DISPLAY, SUBELEMENT, *_INSTANCE); SCOPE tag for graph edges (CONNECTS_TO ord=system-K/opening-K, 0=unscoped). See rel_types.ord_semantics. |

### `scene_views`

| column | type | note |
|---|---|---|
| view | INTEGER | · |
| name | VARCHAR | · |
| is_default | BOOLEAN | · |
| ord | INTEGER | · |
| source | VARCHAR | · |
| ref | VARCHAR | · |

### `type_eav`

| column | type | note |
|---|---|---|
| type_index | INTEGER | · |
| path_index | INTEGER | · |
| value_string | VARCHAR | · |
| value_double | DOUBLE | · |
| value_boolean | BOOLEAN | · |
| unit | VARCHAR | · |
| internal_definition_name | VARCHAR | · |

### `types`

| column | type | note |
|---|---|---|
| type_index | INTEGER | · |
| type_key | VARCHAR | · |

