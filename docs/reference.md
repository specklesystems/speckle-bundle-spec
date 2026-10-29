<!-- GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT. Run npm run generate. -->
# Speckle bundle format — reference (schema_version 1.5.0)

Generated from `spec/bundle-spec.sql`. Rationale & design history live in `docs/rationale/`.

## Relations (`rel_types`)

| id | name | src → dst | status | emitted by | ord | description / why |
|---|---|---|---|---|---|---|
| 1 | **DISPLAY** | object → geometry | 🟢 live | rvextract,dwgextract,dgnextract,skpextract,teklaextract,managed | ordinal | Object → its own mesh. — *Top-level direct meshes (walls, in-place). Navis never uses it — everything there is an instance.* |
| 2 | **SOLID** | object → geometry | 🟢 live | dwgextract,managed | ordinal | Solid body, distinct from a display mesh. — *Rhino/Civil3D ship true solids beside tessellated display meshes; within a definition member, receive prefers the solid over its meshes.* |
| 3 | **SUBELEMENT** | object → object | 🟢 live | rvextract,dwgextract,teklaextract,managed | ordinal | Parent → child containment. — *Railings, mullions, curtain panels — a hierarchy the flat eav cannot encode.* |
| 4 | **DEFINES** | node → geometry | 🟢 live | rvextract,nwextract,dwgextract,dgnextract,skpextract,teklaextract,managed | ordinal | DEFINITION → shared geometry. — *The instancing contract: one mesh owned by a definition, reused by placements. ord is the MEMBER ordinal: rows sharing (definition, ord) are one member's geometries (e.g. a solid + its display meshes) and join to DEFINES_MEMBER on the same key.* |
| 5 | **HAS_MATERIAL** | geometry → node | 🟢 live | rvextract,nwextract,dwgextract,dgnextract,skpextract,teklaextract,managed | · | Geometry → MATERIAL node. — *Base render appearance (full PBR). src is geometry ONLY (union removed post-v5): placement paint lives on OBJECT_HAS_MATERIAL (26), and a placement whose look differs from its shared geometry's overrides this edge with INSTANCE_HAS_MATERIAL (31). Pre-split bundles may still carry INSTANCE srcs tagged ord=1 (ENG-8849 era) — consumers keep the geometry-first fallback.* |
| 6 | **HAS_COLOR** | geometry → node | 🟢 live | dwgextract,dgnextract,skpextract,managed | · | Geometry → COLOR node. — *Display colour — kept distinct from HAS_MATERIAL because it drives a different viewer render mode. src is geometry ONLY (union removed post-v5): object-plane colour lives on OBJECT_HAS_COLOR (27). Pre-split bundles may still carry object srcs.* |
| 7 | **ON_LEVEL** | object → node | 🟢 live | rvextract,nwextract,managed | · | Object → LEVEL node. — *Storey membership; also the default scene-view tier.* |
| 8 | **DISPLAY_INSTANCE** | object → node | 🟢 live | rvextract,nwextract,dwgextract,dgnextract,skpextract,teklaextract,managed | ordinal | Object → INSTANCE node (top level). — *Place a definition here with a transform. STRICTLY a render contract — every edge is a world-space render root. For the object↔placement association WITHOUT rendering (definition members) use PLACES (24); overloading this rel would draw members untransformed at the origin on deployed consumers [ENG-8782].* |
| 9 | **DEFINES_INSTANCE** | node → node | 🟢 live | rvextract,dwgextract,skpextract,managed | ordinal | DEFINITION → nested INSTANCE node. — *Nested instancing — a definition that itself contains placed instances. ord shares the definition's SINGLE member-ordinal space with DEFINES (4) and DEFINES_MEMBER (25) — one authored sequence numbers all members, geometry and nested-instance alike, so interleaved member order round-trips.* |
| 10 | **IN_COLLECTION** | object → node | 🟢 live | nwextract,dwgextract,dgnextract,skpextract,managed | · | Object → CONTAINER(Collection). — *Authored layer/collection-tree membership.* |
| 11 | **IN_MODEL** | object → node | 🟢 live | rvextract,nwextract,dgnextract,managed | · | Object → CONTAINER(Model). — *Federation tier (source-file grouping); outermost scene-view tier when >1 model.* |
| 12 | **IN_ROOM** | object → object | 🟢 live | rvextract,managed | · | Object → containing room object. — *Spatial occupancy (furniture/door/window → room). Rooms are objects, not nodes.* |
| 13 | **IN_SPACE** | · | ⚪ retired | · | · | Object → containing MEP space. — *Retired in v5: ODA exposes no element→space membership (getRoomId only). Spaces ship as objects with eav.* |
| 14 | **IN_SYSTEM** | object → node | 🟢 live | rvextract,nwextract,dwgextract,managed | · | Object → CONTAINER(MEP System \| Network). — *MEP grouping membership. Carries BOTH authored Revit systems and derived Navis networks — the container subtype distinguishes them (the IN_NETWORK collapse).* |
| 15 | **IN_NETWORK** | · | ⚪ retired | · | · | Object → derived MEP network. — *Retired in v5: collapsed into IN_SYSTEM (subtype=Network).* |
| 16 | **IN_LINE** | · | ⚪ retired | · | · | Object → civil alignment/line. — *Retired in v5: never emitted; reintroduce if/when a producer needs it.* |
| 17 | **IN_GROUP** | object → node | 🟢 live | rvextract,dwgextract,managed | · | Object → CONTAINER(Group). — *Authored scene-group membership (Rhino/AutoCAD groups). A separate axis from IN_COLLECTION: an object keeps its layer AND its group(s); groups may nest (CONTAINER def_ref) and overlap. Un-retired post-v5.* |
| 18 | **IN_ASSEMBLY** | object → object | 🟢 live | teklaextract | ordinal | Member object → containing assembly object. — *Authored fabrication membership, separate from SUBELEMENT ownership. ord=0 is the main member; ord>=1 orders secondary or nested-assembly members.* |
| 19 | **IN_SUBASSEMBLY** | · | ⚪ retired | · | · | Object → subassembly. — *Retired in v5: never emitted.* |
| 20 | **XREF** | · | ⚪ retired | · | · | External reference link. — *Retired in v5: never emitted.* |
| 21 | **CONNECTS_TO** | object → object | 🟢 live | rvextract,nwextract,dwgextract,teklaextract,managed | scope | Object → object connectivity (directed). — *The connectivity graph. ord scopes it: system-K (MEP flow), opening-K (room adjacency), 0 (Navis port-cluster / unscoped).* |
| 22 | **HOSTED_ON** | object → object | 🟢 live | rvextract,teklaextract,managed | · | Hosted element → host. — *Revit hosting (door/window → wall, fixture → ceiling/floor/face) from ODA getHostId. A DIFFERENT semantic from SUBELEMENT ownership (owningElemId): a door is placed on a wall, not a component of it. Emitted only when the element has no owner (legacy precedence) and both endpoints are converted. Un-retired post-v5.* |
| 23 | **BOUNDS** | object → object | 🟢 live | rvextract | · | Bounding element → room object. — *The room envelope, for downstream egress / plan analysis. BOTH halves, undifferentiated: the plan perimeter (walls, columns, room separation lines — Revit computes these in 2D at the room's computation height) and the horizontal caps (floors, ceilings, roofs). Filter the src object by category for the plan-only footprint.* |
| 24 | **PLACES** | object → node | 🟢 live | managed | · | Member object → its INSTANCE node (association only). — *The object↔node map for one source thing split across both planes. Ties a render-edge-less definition-member object to its nested placement so its properties and IN_COLLECTION stay reachable; replaces the @speckle.instance_k eav stamp [ENG-9110]. NEVER a render root — that is DISPLAY_INSTANCE.* |
| 25 | **DEFINES_MEMBER** | node → object | 🟢 live | managed | ordinal | DEFINITION → member object. — *Definition membership on the OBJECT plane, where nothing is deduped — emitted for EVERY member, geometry and nested-instance alike. ord is THE member ordinal: one authored sequence per definition, shared with DEFINES (4) and DEFINES_INSTANCE (9), so interleaved member order round-trips. A geometry member's content is its DEFINES rows joined on (definition, ord) — dedup-safe even when content-hashing collapses identical meshes across definitions; an instance member's placement is its PLACES edge. Replaces the @speckle.geometry_k eav stamp.* |
| 26 | **OBJECT_HAS_MATERIAL** | object → node | 🟢 live | managed | · | Object → MATERIAL node (placement paint). — *Placement painting on the object plane (SketchUp instance painting, ENG-8849 — formerly HAS_MATERIAL's INSTANCE src / the ord=1 stamp). FILL semantics: geometry-level HAS_MATERIAL wins (only a placement's INSTANCE_HAS_MATERIAL, rel 31, outranks it); the object's material fills definition geometry with no material of its own, resolved down the placement chain (a nested member object reaches its placement via PLACES). NOTE: OBJECT_HAS_COLOR (27) deliberately INVERTS this precedence — material is intrinsic, colour is presentational.* |
| 27 | **OBJECT_HAS_COLOR** | object → node | 🟢 live | managed | · | Object → COLOR node (object-plane colour). — *Object-plane colour (formerly HAS_COLOR's object src). OVERRIDE semantics — deliberately the INVERSE of OBJECT_HAS_MATERIAL: material is intrinsic (geometry owns, object fills), colour is presentational (object overrides, geometry is the default). Deployed receives already resolve object colour last-write-wins over geometry colour, and this rel's own use cases — per-object colour on deduped twin meshes, clash/status highlighting, CAD ByBlock-style inheritance — only work when the object wins. Resolution: object > geometry > NODE_HAS_COLOR (container default) > none.* |
| 28 | **NODE_HAS_MATERIAL** | node → node | 🟢 live | managed | · | Node → MATERIAL node (container appearance). — *The authored layer/tag render material (Rhino layer material, AutoCAD/Civil3D layer material, SketchUp tag material) — the assignment receivers restore on the rebuilt container, which the member-geometry flatten [ENG-9108] erased before this rel existed. Weakest tier of the material ladder (FILL semantics, rel 26): geometry HAS_MATERIAL wins, then OBJECT_HAS_MATERIAL, then the container's NODE_HAS_MATERIAL reached via the object's membership edge (IN_COLLECTION). Producers keep flattening the inherited material onto member geometry so render-only consumers never need the ladder walk; this edge carries the authored source of that flatten.* |
| 29 | **NODE_HAS_COLOR** | node → node | 🟢 live | managed | · | Node → COLOR node (container display colour). — *Layer/tag display colour as a first-class edge, the colour twin of NODE_HAS_MATERIAL and — like it — the weakest tier: colour resolves object > geometry > container (the container edge is the ByLayer default that applies when nothing more specific does, so OBJECT_HAS_COLOR's override precedence, rel 27, is untouched). Supersedes the argb managed producers stamped directly on CONTAINER rows — an undocumented carrier; consumers prefer this edge and keep reading CONTAINER argb as the fallback for older bundles.* |
| 30 | **CENTERLINE** | object → geometry | 🟢 live | managed | ordinal | Object → its centerline / axis. — *The axis a run or member follows, distinct from the shell that renders it. Downstream routing, length take-off, clash lines and single-line drawings all need the curve, not the tessellated tube. TWO SHAPES, both under one rel because a consumer asking "where is the axis" does not care which: (a) the element's own authored location curve, for anything placed along a curve — a duct, pipe, conduit or tray IS its centerline, and a framing member's axis is the same datum; (b) for a point-placed MEP fitting (elbow, tee, cross, transition), which has no location curve at all, ONE SEGMENT PER CONNECTOR from the connector to the fitting's node — what a single-line drawing draws, and the only shape that survives a branch, where no single curve can. ord is the branch index, so (b) is multi-valued and ordered. CAVEAT on (a): for some families the authored curve is not literally the centre — a Revit wall's location line follows its Location Line type parameter and may be a core or finish face. STRICTLY NOT a render edge, which is why it is its own rel rather than a role on DISPLAY (1): a consumer drawing every geometry-target rel would draw the axis through the middle of the duct.* |
| 31 | **INSTANCE_HAS_MATERIAL** | node → node | 🟡 reserved | · | · | INSTANCE → MATERIAL node (placement look). — *The look one placement draws its definition's geometry with, for placements of one shared geometry that differ in look: a Navisworks saved appearance belongs to each placement of a geometry record, and content-hash dedup merges equal records further (ENG-11304). OVERRIDE semantics, the top tier of the material ladder: for every geometry drawn through this INSTANCE, nested definitions included, it wins over the geometry's HAS_MATERIAL; with nested placements the nearest INSTANCE carrying the edge wins. Ladder: INSTANCE_HAS_MATERIAL > HAS_MATERIAL > OBJECT_HAS_MATERIAL > NODE_HAS_MATERIAL. Producers still write HAS_MATERIAL on the geometry, so a consumer that does not read this rel draws one of the looks. Not on the object plane: one object can own several INSTANCE nodes with different looks, which OBJECT_HAS_MATERIAL (26) cannot tell apart, and letting 26 override would change what existing bundles mean.* |
| 32 | **ASSIGNED_MATERIAL** | object → node | 🟡 reserved | · | · | Object → MATERIAL node the source assigned (not drawn). — *The material the authoring application assigned to the object, kept beside the look it is drawn with when the two differ: Navisworks keeps an item's source material after a saved appearance override, as IFC keeps a material association beside a presentation style (ENG-11304). STRICTLY NOT a render edge: the material ladder ignores it. Absent ⇒ the drawn look is the assigned one, or the source keeps no separate assignment.* |

## Node kinds (`node_kinds`)

| id | name | status | columns | subtypes | description / why |
|---|---|---|---|---|---|
| 1 | **DEFINITION** | 🟢 live | name?,def_ref? | · | Shared geometry template. — *Target of DEFINES; reused by many placements.* |
| 2 | **INSTANCE** | 🟢 live | transform,units?,def_ref | · | A placement / occurrence. — *Carries the composed transform; bulk-scanned on load.* |
| 3 | **MATERIAL** | 🟢 live | name?,argb,opacity,metalness,roughness,emissive?,ior? | · | Full-PBR render asset. — *Target of HAS_MATERIAL. name is the authored host material name (nullable) — receivers recreate the host material under it instead of a colour-derived placeholder. emissive/ior complete the universal PBR scalar set [ENG-8791]. Texture slots are material_textures rows [ENG-11304].* |
| 4 | **COLOR** | 🟢 live | argb | · | Raw colour override. — *Target of HAS_COLOR; a SEPARATE viewer render mode from MATERIAL (an object can carry both). Colour only — alpha rides the argb byte, so opacity stays MATERIAL-only.* |
| 5 | **LEVEL** | 🟢 live | name?,elevation | · | A storey. — *Target of ON_LEVEL; elevation drives architectural ordering.* |
| 6 | **COLLECTION** | ⚪ retired | · | · | Authored layer/collection node. — *Retired in v5: folded into CONTAINER (subtype=Collection).* |
| 7 | **CONTAINER** | 🟢 live | name?,def_ref?,subtype,gh_topology? | Collection,Layer,Folder,Model,MEP System,Network,Group | Polymorphic grouping tree. — *The single grouping node; subtype is its only discriminator. Targets of IN_COLLECTION / IN_MODEL / IN_SYSTEM / IN_GROUP; src of NODE_HAS_MATERIAL / NODE_HAS_COLOR (layer/tag appearance).* |

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
| `model` | `{base}.eav.model.parquet` | no | no | no | OPTIONAL model/document-scoped attributes (object-less eav rows: Revit/Civil3D/Grasshopper document settings, project info). Home of the reference-point record: referencePoint.kind/.transform/.units (see meta header comment) and the model health counts: modelHealth.* (see the model table comment). |
| `revit_warnings` | `{base}.eav.revit_warnings.parquet` | no | no | no | OPTIONAL authoring-tool warnings persisted in the source document, one row per (warning, offending element), with the tool's display text (FEA-576). |
| `revit_external_links` | `{base}.eav.revit_external_links.parquet` | no | no | no | OPTIONAL external files the source document links or imports (linked models, linked/imported CAD), one row per placed instance (FEA-576). |
| `revit_views` | `{base}.eav.revit_views.parquet` | no | no | no | OPTIONAL the source document's views, view templates and sheets, one row per element, matching the modelHealth view counts (ENG-11116). |
| `textures` | `{base}.textures*.parquet` | yes | no | no | OPTIONAL image bytes for material texture slots (content-hash deduped, ENG-11304). SHARDED like geometries: shard 0 = {base}.textures.parquet, overflow = {base}.textures.{N}.parquet; read the glob. |
| `material_textures` | `{base}.envelope.material_textures.parquet` | no | no | no | OPTIONAL texture slots of MATERIAL nodes: the image in textures, or the unresolved source reference (ENG-11304). |

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

### `material_textures`

| column | type | note |
|---|---|---|
| material | INTEGER | MATERIAL node K (nodes.id of a kind-3 node). |
| role | VARCHAR | diffuse \| bump \| other. diffuse replaces the RGB of the material's argb where drawn, and argb stays the fallback colour; bump is a bump or normal map; other is any other mapped property. property names the source property for every role. Closed vocabulary; a consumer skips roles it does not draw. |
| ord | INTEGER | Slot order within (material, role), from 0. A consumer that draws one texture per role takes ord 0. |
| status | VARCHAR | resolved \| not_found \| url \| invalid; texture is set exactly when status = resolved. not_found: a path the producer could not read. A receiver that has the source application's library resolves it against its own files, in order: saved_location; uri as a path, absolute as is or relative against each library root; the file name of uri in each library root. url: a reference with a URL scheme; the producer fetched nothing, and a receiver fetches it only if its policy allows network access. invalid: a reference that names no file; never resolved. |
| texture | INTEGER | textures.texture_index of the image; NULL unless status = resolved. |
| uv_transform | VARCHAR | Row-major 2x3 affine as CSV "a,b,c,d,e,f" from a geometry's SGEO UVs (u, v) to image coordinates: s = a*u + b*v + c, t = d*u + e*v + f. Image coordinates put (0, 0) at the image's bottom-left corner, s to the right and t up, one image per unit, repeating. A writer whose UVs already are image coordinates writes "1,0,0,0,1,0". NULL = the producer could not place the image on the UVs: the reference travels, but a consumer draws no image from this slot. |
| uri | VARCHAR | The reference as the source stores it: a path (often relative to the source application's material library) or a URL. NULL when the source names none, as for an image embedded without a name. |
| saved_location | VARCHAR | The absolute path the source recorded for the image when the file was saved, when it recorded one beside uri. |
| property | VARCHAR | The source's name for the mapped property (an asset property ID such as generic_diffuse); NULL when the source has none. |

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
| subtype | VARCHAR | CONTAINER polymorphism, one of node_kinds.subtype_values. The single grouping discriminator (replaced the former units-overload). Collection, Layer and Folder are levels of the IN_COLLECTION tree; Model is the IN_MODEL tier; MEP System and Network are IN_SYSTEM; Group is the overlapping IN_GROUP axis, never a tree level. |
| argb | INTEGER | MATERIAL/COLOR packed colour. |
| opacity | DOUBLE | MATERIAL alpha (0-1). MATERIAL-only — a COLOR node carries alpha in its argb alpha byte. |
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
| set_name | VARCHAR | Authored definition name ('Pipe Data') — the key the eav value paths carry (properties.Property Sets.{set_name}.*), so it is the first hop of the rebind join. |
| set_key | VARCHAR | Content hash of the definition (name + ordered field tuples; recipe must be byte-identical across producers). SET-level identity: C3D allows two same-named set definitions — set_key keeps their rows apart in this file and dedupes identical schemas across merged bundles. Value rows cannot carry it (paths have only the name); rebind disambiguates same-named sets by field_bucket_id membership. |
| set_description | VARCHAR | The SET's own authored description (PropertySetDefinition.Description) — distinct from the per-field description. |
| field_name | VARCHAR | · |
| field_bucket_id | VARCHAR | The field's FieldBucketId — the SAME string the value rows ship in eav.internal_definition_name, so this is THE rebind join key (field-scoped: unique within its set only). NULL when the producer could not observe it (definition never attached to a sent object) — rebind falls back to matching field_name against the value path leaf. |
| data_type | VARCHAR | Host datatype enum as text (Real \| Text \| Integer \| TrueFalse \| List \| …) — faithful recreate without inferring from values. |
| default_string | VARCHAR | At most ONE of default_string / default_double / default_boolean is set (the eav exactly-one-value convention); all NULL = no default. |
| default_double | DOUBLE | · |
| default_boolean | BOOLEAN | · |
| unit | VARCHAR | Autodesk unit DISPLAY text (UnitType.GetTypeDisplayName), '(none)' filtered to NULL — same source and caveat as the value rows' unit. |
| description | VARCHAR | The FIELD's authored description. |
| applies_to | VARCHAR | Csv of host entity-type filters the set applies to; NULL = apply-to-all (or producer could not capture it). |

### `relations`

| column | type | note |
|---|---|---|
| rel | INTEGER | · |
| src | INTEGER | · |
| dst | INTEGER | · |
| ord | INTEGER | Dual-use: ORDINAL for ordered rels (DISPLAY, SUBELEMENT, *_INSTANCE); SCOPE tag for graph edges (CONNECTS_TO ord=system-K/opening-K, 0=unscoped). See rel_types.ord_semantics. |

### `revit_external_links`

| column | type | note |
|---|---|---|
| kind | VARCHAR | rvt_link (linked Revit model) \| cad_link (linked CAD) \| cad_import (CAD imported into the document). CAD nested inside family definitions is not listed — the authoring tool does not count it either. |
| element_id | VARCHAR | Producer-native id of the placed instance (Revit ElementId, as text). |
| name | VARCHAR | File name of the linked/imported file as the document records it (no directory); NULL when the producer cannot resolve it. |
| view_specific | BOOLEAN | True when placed in a single view (Revit: "Current view only") rather than in the model. |
| is_included | BOOLEAN | rvt_link: whether this placement's linked model was converted into this bundle (its objects carry IN_MODEL to their own CONTAINER(Model)). False when the linked file was not supplied, is nested in another link, or failed to convert. NULL for kinds whose content is never a separate model (cad_link, cad_import), when the producer could not tell, and in bundles written before the column existed. |
| workset | VARCHAR | Workset the placed instance is on, by name (ENG-11122); NULL when the document is not workshared and in bundles written before the column existed. |
| transform | VARCHAR | rvt_link: the placement's total transform, link internal coordinates to host internal coordinates, row-major 4x4 as CSV like nodes.transform, translation in the unit of the model row modelPlacement.units (ENG-11122). NULL for cad_link / cad_import and in bundles written before the column existed. |

### `revit_views`

| column | type | note |
|---|---|---|
| element_id | VARCHAR | Producer-native element id of the view (Revit ElementId, as text). view_template_id refers to rows by this id. |
| name | VARCHAR | View name as shown in the project browser; for a sheet, the sheet name. |
| view_type | VARCHAR | The authoring tool's view type name (Revit ViewType: FloorPlan, CeilingPlan, Elevation, Section, ThreeD, Schedule, DraftingView, Legend, DrawingSheet, AreaPlan, EngineeringPlan, Detail, …). |
| is_template | BOOLEAN | True for a view template. |
| view_template_id | VARCHAR | element_id of the view template applied to this view; NULL when none is applied, and for templates and sheets. |
| sheet_number | VARCHAR | DrawingSheet only: the sheet number. |
| sheet_placements | INTEGER | How many sheet viewports show this view (0 = on no sheet). NULL for sheets and templates, and for view types a sheet shows by other means than a viewport (schedules). |
| orientation | VARCHAR | Plan views only: project_north \| true_north, the view's Orientation setting. NULL for other view types. |

### `revit_warnings`

| column | type | note |
|---|---|---|
| warning_index | INTEGER | Groups the rows of one warning; dense 0..n-1 within the bundle. |
| warning_class | VARCHAR | The producer-native warning class (Revit via ODA: OdBm*Warning, e.g. OdBmElemsOverlapWarning). Stable machine key; not for display. |
| warning_type | INTEGER | The class's native message selector (Revit: getType / getMsgType / getWarningType); NULL when the class has none. With warning_class and element_category it selects the displayed text. |
| warning_kind | VARCHAR | Neutral taxonomy of the warning, from its class (and selector where one class covers unrelated warnings): overlap \| duplicate \| room_space \| stairs_railings \| insert_join \| mep_system \| off_axis \| geometry (generation / sweep / mass failures) \| other. Closed vocabulary; other = unmapped. Which kinds need attention is a consumer judgement, not encoded here. |
| failure_definition_id | VARCHAR | The authoring tool's failure-definition identity when known (Revit FailureDefinitionId GUID, as returned by FailureMessage.GetFailureDefinitionId) — joins Revit API tooling; NULL when unmapped. |
| description | VARCHAR | Display text as the authoring tool words it; for an unmapped (class, type) a humanized class name ('Elems overlap'). Same value on every row of a warning. |
| element_id | VARCHAR | Producer-native element id of the offending element (Revit ElementId, as text); NULL for a warning without element refs. |
| element_application_id | VARCHAR | Weak reference → objects.application_id (Revit UniqueId). May match no object: the offending element need not be exported. |
| element_category | VARCHAR | Built-in category of the offending element (Revit OST_* enum name); NULL for non-built-in categories. |

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

### `textures`

| column | type | note |
|---|---|---|
| texture_index | INTEGER | Dense int K (the texture K-space). |
| content | BLOB | The image file as the producer found it, never decoded or re-encoded. |
| id | VARCHAR | Lower-case hex SHA-256 of content; equal bytes are one row. |
| format | VARCHAR | Image format from the leading bytes: png \| jpeg \| bmp \| gif \| tiff \| webp \| unknown. Bytes are not re-encoded, so a consumer can meet a format it cannot decode. |
| name | VARCHAR | File name (no directory) the image was read from, or the embedded entry's name; NULL when the source names none. |

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

