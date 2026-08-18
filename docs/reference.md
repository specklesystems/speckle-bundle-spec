<!-- GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT. Run npm run generate. -->
# Speckle bundle format — reference (schema_version 5)

Generated from `spec/bundle-spec.sql`. Rationale & design history live in `docs/rationale/`.

## Relations (`rel_types`)

| id | name | src → dst | status | emitted by | ord | description / why |
|---|---|---|---|---|---|---|
| 1 | **DISPLAY** | object → geometry | 🟢 live | rvextract | ordinal | Object → its own mesh. — *Top-level direct meshes (walls, in-place). Navis never uses it — everything there is an instance.* |
| 2 | **SOLID** | object → geometry | 🟢 live | managed | ordinal | Solid body, distinct from a display mesh. — *Rhino/Civil3D ship true solids beside tessellated display meshes; within a definition member, receive prefers the solid over its meshes.* |
| 3 | **SUBELEMENT** | object → object | 🟢 live | rvextract | ordinal | Parent → child containment. — *Railings, mullions, curtain panels — a hierarchy the flat eav cannot encode.* |
| 4 | **DEFINES** | node → geometry | 🟢 live | rvextract,nwextract | ordinal | DEFINITION → shared geometry. — *The instancing contract: one mesh owned by a definition, reused by placements. ord is the MEMBER ordinal: rows sharing (definition, ord) are one member's geometries (e.g. a solid + its display meshes) and join to DEFINES_MEMBER on the same key.* |
| 5 | **HAS_MATERIAL** | geometry → node | 🟢 live | rvextract,nwextract | · | Geometry → MATERIAL node. — *Base render appearance (full PBR). src is geometry ONLY (union removed post-v5): placement paint lives on OBJECT_HAS_MATERIAL (26). Pre-split bundles may still carry INSTANCE srcs tagged ord=1 (ENG-8849 era) — consumers keep the geometry-first fallback.* |
| 6 | **HAS_COLOR** | geometry → node | 🟢 live | managed | · | Geometry → COLOR node. — *Display colour — kept distinct from HAS_MATERIAL because it drives a different viewer render mode. src is geometry ONLY (union removed post-v5): object-plane colour lives on OBJECT_HAS_COLOR (27). Pre-split bundles may still carry object srcs.* |
| 7 | **ON_LEVEL** | object → node | 🟢 live | rvextract,nwextract | · | Object → LEVEL node. — *Storey membership; also the default scene-view tier.* |
| 8 | **DISPLAY_INSTANCE** | object → node | 🟢 live | rvextract,nwextract | ordinal | Object → INSTANCE node (top level). — *Place a definition here with a transform. STRICTLY a render contract — every edge is a world-space render root. For the object↔placement association WITHOUT rendering (definition members) use PLACES (24); overloading this rel would draw members untransformed at the origin on deployed consumers [ENG-8782].* |
| 9 | **DEFINES_INSTANCE** | node → node | 🟢 live | rvextract | ordinal | DEFINITION → nested INSTANCE node. — *Nested instancing — a definition that itself contains placed instances.* |
| 10 | **IN_COLLECTION** | object → node | 🟢 live | managed | · | Object → CONTAINER(Collection). — *Authored layer/collection-tree membership.* |
| 11 | **IN_MODEL** | object → node | 🟢 live | nwextract | · | Object → CONTAINER(Model). — *Federation tier (source-file grouping); outermost scene-view tier when >1 model.* |
| 12 | **IN_ROOM** | object → object | 🟢 live | rvextract | · | Object → containing room object. — *Spatial occupancy (furniture/door/window → room). Rooms are objects, not nodes.* |
| 13 | **IN_SPACE** | · | ⚪ retired | · | · | Object → containing MEP space. — *Retired in v5: ODA exposes no element→space membership (getRoomId only). Spaces ship as objects with eav.* |
| 14 | **IN_SYSTEM** | object → node | 🟢 live | rvextract,nwextract | · | Object → CONTAINER(MEP System \| Network). — *MEP grouping membership. Carries BOTH authored Revit systems and derived Navis networks — the container subtype distinguishes them (the IN_NETWORK collapse).* |
| 15 | **IN_NETWORK** | · | ⚪ retired | · | · | Object → derived MEP network. — *Retired in v5: collapsed into IN_SYSTEM (subtype=Network).* |
| 16 | **IN_LINE** | · | ⚪ retired | · | · | Object → civil alignment/line. — *Retired in v5: never emitted; reintroduce if/when a producer needs it.* |
| 17 | **IN_GROUP** | object → node | 🟢 live | managed | · | Object → CONTAINER(Group). — *Authored scene-group membership (Rhino/AutoCAD groups). A separate axis from IN_COLLECTION: an object keeps its layer AND its group(s); groups may nest (CONTAINER def_ref) and overlap. Un-retired post-v5.* |
| 18 | **IN_ASSEMBLY** | object → object | 🟢 live | teklaextract | ordinal | Member object → containing assembly object. — *Authored fabrication membership, separate from SUBELEMENT ownership. ord=0 is the main member; ord>=1 orders secondary or nested-assembly members.* |
| 19 | **IN_SUBASSEMBLY** | · | ⚪ retired | · | · | Object → subassembly. — *Retired in v5: never emitted.* |
| 20 | **XREF** | · | ⚪ retired | · | · | External reference link. — *Retired in v5: never emitted.* |
| 21 | **CONNECTS_TO** | object → object | 🟢 live | rvextract,nwextract | scope | Object → object connectivity (directed). — *The connectivity graph. ord scopes it: system-K (MEP flow), opening-K (room adjacency), 0 (Navis port-cluster / unscoped).* |
| 22 | **HOSTED_ON** | object → object | 🟢 live | rvextract | · | Hosted element → host. — *Revit hosting (door/window → wall, fixture → ceiling/floor/face) from ODA getHostId. A DIFFERENT semantic from SUBELEMENT ownership (owningElemId): a door is placed on a wall, not a component of it. Emitted only when the element has no owner (legacy precedence) and both endpoints are converted. Un-retired post-v5.* |
| 23 | **BOUNDS** | object → object | 🟢 live | rvextract | · | Bounding wall → room object. — *Room footprint (which walls bound a room) for downstream egress / plan analysis.* |
| 24 | **PLACES** | object → node | 🟢 live | managed | · | Member object → its INSTANCE node (association only). — *The object↔node map for one source thing split across both planes. Ties a render-edge-less definition-member object to its nested placement so its properties and IN_COLLECTION stay reachable; replaces the @speckle.instance_k eav stamp [ENG-9110]. NEVER a render root — that is DISPLAY_INSTANCE.* |
| 25 | **DEFINES_MEMBER** | node → object | 🟢 live | managed | ordinal | DEFINITION → member object. — *Definition membership on the OBJECT plane, where nothing is deduped. ord = the member ordinal also carried by the member's DEFINES rows: joining (definition, ord) recovers each member's geometry even when content-hash dedup collapses identical meshes across definitions. Replaces the @speckle.geometry_k eav stamp; instance-members join via PLACES instead.* |
| 26 | **OBJECT_HAS_MATERIAL** | object → node | 🟢 live | managed | · | Object → MATERIAL node (placement paint). — *Placement painting on the object plane (SketchUp instance painting, ENG-8849 — formerly HAS_MATERIAL's INSTANCE src / the ord=1 stamp). FILL semantics: geometry-level HAS_MATERIAL always wins; the object's material fills definition geometry with no material of its own, resolved down the placement chain (a nested member object reaches its placement via PLACES).* |
| 27 | **OBJECT_HAS_COLOR** | object → node | 🟢 live | managed | · | Object → COLOR node (object-plane colour). — *Object-plane colour (formerly HAS_COLOR's object src). FILL semantics matching OBJECT_HAS_MATERIAL: geometry-level HAS_COLOR wins; the object colour applies where the geometry carries none (per-object display colour on deduped meshes, CAD ByBlock-style inheritance).* |

## Node kinds (`node_kinds`)

| id | name | status | columns | subtypes | description / why |
|---|---|---|---|---|---|
| 1 | **DEFINITION** | 🟢 live | name,def_ref | · | Shared geometry template. — *Target of DEFINES; reused by many placements.* |
| 2 | **INSTANCE** | 🟢 live | transform,units,def_ref | · | A placement / occurrence. — *Carries the composed transform; bulk-scanned on load.* |
| 3 | **MATERIAL** | 🟢 live | name,argb,opacity,metalness,roughness,emissive,ior | · | Full-PBR render asset. — *Target of HAS_MATERIAL. name is the authored host material name (nullable) — receivers recreate the host material under it instead of a colour-derived placeholder. emissive/ior complete the universal PBR scalar set [ENG-8791].* |
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
| `meta` | `{base}.envelope.meta.parquet` | no | yes | yes | schema_version + producer provenance. |
| `scene_views` | `{base}.envelope.scene_views.parquet` | no | no | yes | Producer-authored default projection. |
| `geometries` | `{base}.geometries*.parquet` | yes | yes | no | SGEO mesh blobs (content-hash deduped). SHARDED: shard 0 = {base}.geometries.parquet, overflow = {base}.geometries.{N}.parquet; read the glob. |
| `camera_views` | `{base}.envelope.camera_views.parquet` | no | no | yes | Named camera viewpoints (eye/forward/up + projection). |
| `structural_results` | `{base}.eav.structural_results.parquet` | no | no | no | OPTIONAL per-domain purpose file: structural analysis/design results (long/tidy scalar rows). Present only when a structural producer (ETABS/CSi/SAP/TSD) publishes results for a locked model. |
| `property_set_definitions` | `{base}.eav.property_set_definitions.parquet` | no | no | no | OPTIONAL schema catalog: AEC property-set definitions (shape only — values stay in eav, attachment derived from value paths). |
| `model` | `{base}.eav.model.parquet` | no | no | no | OPTIONAL model/document-scoped attributes (object-less eav rows: Revit/Civil3D/Grasshopper document settings, project info). |

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

### `model`

| column | type | note |
|---|---|---|
| path | VARCHAR | · |
| value_string | VARCHAR | · |
| value_double | DOUBLE | · |
| value_boolean | BOOLEAN | · |
| unit | VARCHAR | · |

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
| emissive | INTEGER | MATERIAL packed emissive colour (ARGB). NULL = no emission (producers normalize black RGB to NULL); consumers default NULL to black [ENG-8791]. |
| ior | DOUBLE | MATERIAL index of refraction (PBR scalar, typically 1.0–2.5); NULL = unset [ENG-8791]. |
| elevation | DOUBLE | LEVEL height — lets the scene tree order storeys architecturally. |
| gh_topology | VARCHAR | Grasshopper collection topologies. i.e. 0-1 0;0-1 to keep them as source on receive. |

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

### `property_set_definitions`

| column | type | note |
|---|---|---|
| set_name | VARCHAR | · |
| set_key | VARCHAR | · |
| field_name | VARCHAR | · |
| field_id | INTEGER | · |
| data_type | VARCHAR | · |
| default_string | VARCHAR | · |
| default_double | DOUBLE | · |
| unit | VARCHAR | · |
| description | VARCHAR | · |
| applies_to | VARCHAR | · |

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

### `structural_results`

| column | type | note |
|---|---|---|
| object_index | INTEGER | Object-level results only (frame/joint) → objects.object_index. Piers/spandrels are NOT interned objects (named groups of walls) → NULL, identity via element_name. |
| element_name | VARCHAR | · |
| location | VARCHAR | · |
| result_type | VARCHAR | · |
| load_case | VARCHAR | · |
| component | VARCHAR | · |
| position_label | VARCHAR | Categorical position/direction (Top/Bottom, X/Y). Distinct from the numeric member station. |
| station | DOUBLE | · |
| step | INTEGER | · |
| value | DOUBLE | · |
| value_text | VARCHAR | Exactly one of value (numeric) / value_text (verdict) is set; consumer coalesces. value_text is NULL for all analysis results. |

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

