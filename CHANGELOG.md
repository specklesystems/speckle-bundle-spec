# Changelog

Schema versions track `meta.schema_version` in `spec/bundle-spec.sql` — the semver
string of this package (see `VERSIONING.md`).

## unreleased (schema_version 1.0.0, additive)

**Catalog primary keys aligned with the deployed bundle contract**
- `rel_types.id` is corrected to `rel_types.rel`, and `node_kinds.id` to
  `node_kinds.kind`. Existing producers, SDKs, frontend queries, and bundle files
  already use `rel` / `kind`; only the standalone executable spec used generic
  `id` names.
- Generated language APIs continue exposing catalog entries through `id`, so this
  correction does not rename generated constants or record fields. Conformance now
  guards the physical parquet column names explicitly.
- No schema bump: this restores the already-deployed wire contract before the
  standalone `id` spelling was adopted by production producers or consumers.

**Mount contract: `paths_raw` + the virtual `applicationId` path** (query conformance)
- Ratifies the mounted-schema change the three JS mount replicas shipped in
  specklesystems/speckle-server-internal#2649. No bundle-file change: the spec DDL,
  `generated/` and the golden parquet bytes are untouched — this is the *mount* contract,
  the shape an engine must expose over an unchanged bundle.
- The paths parquet now mounts as **`paths_raw`**; the public `paths` view is the raw
  dictionary `UNION ALL` a `(-1, 'applicationId')` sentinel, and `object_properties` grows
  a third arm read from `objects` (`path_index` `-1`, `value_string` = `application_id`).
  Producers carry applicationId only in `objects`, so without this the path-keyed lanes
  (filter criteria, catalogs, value lists) could not reach it. Normative for every engine,
  not a capability — the whole point is cross-engine filter parity.
- Both halves are guarded on the producer not already emitting a real `applicationId` path
  (teklaextract, specklepy), so no bundle sees duplicate rows. The golden bundle does not
  emit it, so the goldens pin the synthesized branch; `tests/query-conformance/run.mjs`
  replays the mount over a `paths_raw` that carries the path to pin the guarded branch.
- `harness.mjs` gains `pathsViewSql` / `bundleMountExtraSql` and the renaming `mountPlan`
  (SQL byte-identical to the ts-sdk original, as the replica invariant requires);
  `schema.json` lists `paths_raw` + `paths` and `objectPropertiesRowCount` 6597 → 6797
  (one virtual row per object, 200 objects); four goldens added, three updated.

**BOUNDS (rel 23) — description corrected to the whole room envelope**
- Text only; no id, namespace, status or column change, so no bump (`VERSIONING.md`:
  comment/rationale edits are additive). `generated/` is untouched by this edit — the
  descriptions live in `spec/bundle-spec.sql` and `docs/reference.md` only. `specHash`
  does change, by design.
- rel 23 was described as "Bounding wall → room object", which understated it. rvextract
  now emits BOTH halves of the envelope, undifferentiated: the plan perimeter (walls,
  columns, room separation lines) and the horizontal caps (floors, ceilings, roofs).
  Consumers wanting the plan-only footprint filter the src object by category.
  Producer side: specklesystems/speckle-converters#116.

**`meta.schema_version` is a semver string**
- `meta.schema_version` changes type `INTEGER` → `VARCHAR` and now carries the spec's
  package semver (`'1.0.0'`) instead of a bare integer. One value names the vocabulary a
  bundle was written against; minor/patch (additive) releases become visible in
  provenance instead of only the major. Generated constants follow (`SchemaVersion`,
  `kSchemaVersion`, `SCHEMA_VERSION` are strings); `publish.mjs` and a conformance
  check enforce `meta.schema_version == package.json version`.
- Not bumped: v1 was pinned but unreleased, so it is re-stamped as `1.0.0`. Readers
  must treat the column as text (old bundles carry the integer `5`/`1`).
- `migrated_from_schema_version` stays `INTEGER` — it records the legacy object-model
  vintage (2/3), a different number.

**Pinned to schema_version 1 (#22)** — the standalone spec restarts its version line at 1.

**Query conformance suite** (`conformance/query/`, ENG-9305)
- The portable suite every bundle query engine runs: one committed KB-scale synthetic
  bundle (every `bundle_files` view incl. the type tables and catalogs, `eav` across 3
  parquet row groups, geometries as 2 shards), golden `(sql, expected)` pairs, a
  `read_csv()` local-data-join case, and `schema.json` pinning the mounted-schema
  invariant (filename → view, schema-per-alias, the `object_properties` union view,
  geometry shards never mounted). `harness.mjs` carries the loader, mount plan and
  result comparison for the JS engines; `README.md` is the engine-facing contract.
- Reference runner `tests/query-conformance/run.mjs` joins `npm test`;
  `npm run build:query-fixture` regenerates the bundle from `fixture.sql`.
- Distribution: `publish:artifacts` pins every suite file under the lock's
  `queryConformance` target; `verify-pin -- --query-conformance <dir>` checks a
  vendored copy. No format change.

**Reference point moves to eav.model; meta.reference_point_* removed**
- The reference-point record now lives ONLY as model-scoped eav rows in the
  `model` file: `referencePoint.kind` / `.transform` (full 16-double rigid
  transform, InstanceProxy layout) / `.units`. The former meta columns
  `reference_point_kind` / `reference_point_offset` are removed — the xyz-only
  offset for point kinds lost rotation, and meta is the wrong home for model
  data. Consumers tolerate the columns as extras on old bundles (the validator
  only requires spec columns) but must not read them.

**Container appearance: NODE_HAS_MATERIAL (28) / NODE_HAS_COLOR (29)**
- Two node→node rels carrying the authored layer/tag appearance (Rhino layer
  material, AutoCAD/Civil3D layer material, SketchUp tag material/colour) —
  previously inexpressible: producers flatten layer-inherited materials onto
  member geometry [ENG-9108], which preserves the render but erases the layer
  assignment on receive.
- Both sit at the WEAKEST tier of their ladders, so existing precedence is
  untouched: material resolves geometry > object > container (fill, rel 26);
  colour resolves object > geometry > container (override, rel 27). Producers
  keep flattening — render-only consumers never need the ladder walk.
- `NODE_HAS_COLOR` supersedes the undocumented `argb` stamped directly on
  CONTAINER rows; consumers prefer the edge and keep the argb read fallback
  for older bundles.
- Validator: dst-kind invariants (28 → MATERIAL, 29 → COLOR), vacuous when
  unemitted, fixture-tested.

**Vocabulary follow-ups: OBJECT_HAS_COLOR precedence, member ordinal contract, emitted_by refresh, member invariants** (amends #15)
- `OBJECT_HAS_COLOR` (27) precedence corrected to OVERRIDE (object > geometry >
  none) — the deliberate INVERSE of `OBJECT_HAS_MATERIAL`'s fill semantics.
  Material is intrinsic (geometry owns, object fills); colour is presentational
  (object overrides). Deployed receives already resolve object colour
  last-write-wins, and the rel's own use cases (per-object colour on deduped twin
  meshes, clash/status highlights, ByBlock-style inheritance) only work when the
  object wins. The fill wording shipped in #15 was never implemented by any
  consumer, so this is a catalog-text correction, not a behaviour change.
- Member ordinal contract made explicit: one authored member sequence per
  definition, shared by `DEFINES` (4), `DEFINES_INSTANCE` (9) and
  `DEFINES_MEMBER` (25) — matching the shipped managed emitter — so interleaved
  geometry/instance member order round-trips. `DEFINES_MEMBER` documented as
  emitted for EVERY member (instance members carry it alongside `PLACES`).
- `emitted_by` refreshed from producer source (grep of every `Rel::` emission +
  the managed pipeline call sites): rows 1–22 now name all actual emitters;
  producer vocabulary extended with `dgnextract` (and `dwgextract`/`skpextract`,
  documented in #15's column comment but used by no row until now).
- Validator: three member/association invariants, vacuous on bundles that don't
  emit the new rels — `PLACES`.dst is an INSTANCE node; `DEFINES_MEMBER` members
  carry no top-level render edge (`DISPLAY`/`SOLID`/`DISPLAY_INSTANCE` — the
  ENG-8782 double-bake shape); every `DEFINES_MEMBER` row resolves via `DEFINES`
  on (definition, ord) or a `PLACES` placement. Fixture-tested in
  `tests/validator/run.mjs`.
- Catalog text + validator + tests only ⇒ **no `schema_version` bump**: no table
  shape changed, no ids minted or retired.

**Member/appearance vocabulary: rels 24–27, unions removed; property-set/model files; `nodes.gh_topology`** (#15)
- `PLACES` (24, `object → node`): association-only tie from a render-edge-less
  definition-member object to its INSTANCE node — replaces the
  `@speckle.instance_k` eav stamp [ENG-9110]. Never a render root (that is
  `DISPLAY_INSTANCE`, now pinned as strictly a top-level render contract).
- `DEFINES_MEMBER` (25, `node → object`): definition membership on the object
  plane, where nothing is deduped; ord joins the member's `DEFINES` rows —
  replaces the `@speckle.geometry_k` eav stamp. `DEFINES` ord declared the
  member ordinal; `SOLID` (2) live.
- `OBJECT_HAS_MATERIAL` (26) / `OBJECT_HAS_COLOR` (27): object-plane appearance;
  `HAS_MATERIAL`/`HAS_COLOR` src narrowed to `geometry` only (union namespaces
  removed; pre-split bundles keep the ord=1 fallback).
- New optional files: `eav.property_set_definitions` (AEC property-set schemas —
  values stay in eav) and `eav.model` (object-less document-scoped eav rows);
  new `nodes.gh_topology` column (Grasshopper collection topology).
- Additive ⇒ no `schema_version` bump: ids minted above the retired range, old
  bundles ship their own catalogs, consumers feature-detect by rel presence.

**`IN_ASSEMBLY` (18) un-retired** (`object → object`, emitted by teklaextract)
- A source member points to its containing source assembly object. Assemblies
  remain objects because they carry stable source identity and arbitrary EAV
  properties; they are not synthetic graph nodes.
- `ord=0` identifies the main member. `ord>=1` gives secondary members and
  nested assembly members a stable source order. An assembly object can itself
  point to a parent assembly, so `IN_SUBASSEMBLY` (19) remains retired.
- Deliberately NOT `SUBELEMENT`: assembly membership is a fabrication axis
  independent from component ownership, hosting, and connectivity.
- Additive ⇒ no `schema_version` bump: the id was retired in place (never
  reused), the catalog is self-describing, and consumers feature-detect by
  relation presence.

**Named column-index constants for writers** (codegen-only)
- New generated targets — `cpp/bundle_cols.h` (`bundlespec::col::<table>::<column>`,
  include-light, no arrow), `csharp/BundleCols.cs` (`BundleCols.<Table>.<Column>`,
  `Speckle.Bundle.Spec`), `python/bundle_cols.py` (`<TABLE>.<COLUMN>`, upper snake) —
  one index constant per produced-table column plus a `columnCount` /
  `ColumnCount` / `COLUMN_COUNT`, in spec order (matches the generated schemas 1:1).
- Why: writers built their schemas FROM the spec but filled rows with hard-coded
  ordinals; the `emissive`/`ior` insertion before `elevation` (12→14 nodes columns)
  silently shifted `elevation`'s ordinal and native producers dropped every nodes
  row (valid-but-empty `envelope.nodes.parquet` → invisible models, fleet-wide).
  With named constants an insertion shifts writers automatically and a
  rename/removal is a compile/import error, never silent drift.
- Validator: new cross-table referential-integrity rule — every relation endpoint
  whose namespace (per `rel_types`) is `node` must resolve to an existing
  `nodes.id`; an EMPTY nodes table while relations reference node endpoints (the
  incident shape) and any dangling endpoint are hard errors. Regression-tested in
  `tests/validator/run.mjs` (fixture bundles, runs under `npm test`).
- Codegen + validator only ⇒ **no `schema_version` bump**: no table shape or
  catalog row changed; published cpp/python artifacts gain one file each.

**MATERIAL nodes: `name` declared + new `emissive`/`ior` columns** [ENG-8791]
- `name` (existing shared column, nullable) is now declared in MATERIAL's catalog
  columns: the authored host material name (Rhino/Revit/AutoCAD material table
  entry), so receivers recreate the host material under it instead of a
  colour-derived placeholder. Producers had always written NULL here.
- New nullable `nodes` columns `emissive` (packed ARGB; NULL = no emission —
  producers normalize black RGB to NULL, consumers default NULL to black) and
  `ior` (index of refraction, NULL = the host has no IOR concept) complete the
  universal PBR scalar set on MATERIAL. Host-specific material enums (e.g.
  Rhino `typeName`) deliberately stay out — not reducible to a cross-host
  scalar.
- Additive ⇒ no `schema_version` bump: all consumers read columns by name and
  guard absence (SDK `Has()`, viewer fallback SELECT); nullable columns are
  invisible to readers that don't ask for them.

**`HOSTED_ON` (22) un-retired** (`object → object`, emitted by rvextract)
- Revit hosting from ODA `getHostId()`: door/window → wall, fixture →
  ceiling/floor/face, window → roof. Direction is hosted element → host,
  as the retired vocabulary already specified.
- Deliberately NOT `SUBELEMENT`: ownership (`owningElemId` — curtain panels,
  mullions, railing supports) means the child is a *component* of the owner;
  hosting means the element is *placed on* the host. Legacy collapsed both into
  one `parentApplicationId` property; the graph keeps them distinct. Producer
  precedence matches legacy: a valid owner wins (SUBELEMENT), host is the
  fallback (HOSTED_ON).
- No dangling edges: emitted only when both endpoints are converted objects
  (a filtered-out host means no edge, not a property fallback).
- Additive ⇒ no `schema_version` bump: the id was retired in place (never
  reused), the catalog is self-describing, and consumers feature-detect by
  rel presence.

**`IN_GROUP` (17) un-retired** (`object → node`, emitted by managed connectors)
- Authored scene-group membership (Rhino groups, AutoCAD groups) → `CONTAINER`
  with new subtype `Group`; groups nest via `def_ref` and may overlap.
- Deliberately NOT `IN_COLLECTION`: the receive side stores IN_COLLECTION
  last-wins single-valued (it *is* the scene tree) — reusing it for groups would
  pull members out of their layer collection. IN_GROUP is a separate,
  multi-valued axis: an object keeps its layer AND its group(s).
- Additive ⇒ no `schema_version` bump: the id was retired in place (never
  reused), the catalog is self-describing, and consumers feature-detect by
  rel presence.

**New optional file: `{base}.envelope.camera_views.parquet`** (`camera_views`, `bundle_files` ord 14)
- Named camera viewpoints authored in the source model (Rhino named views, Revit 3D views,
  SketchUp scenes). One row per view: eye position + forward/up unit vectors (+ optional
  target), projection (`is_ortho`, `fov` = vertical degrees, `lens_mm`, `ortho_height`),
  optional `aspect`/`near`/`far`, `is_default` home-view flag, `units` for all length-bearing
  columns (model units, consumer scales like geometry).
- Distinct from `scene_views` (the explorer *grouping* projection — not viewpoints).
- Additive + `required=false` ⇒ **no `schema_version` bump**: old consumers skip the unknown
  optional file; consumers feature-detect and fall back when absent.

**New optional file: `{base}.eav.structural_results.parquet`** (`structural_results`, `bundle_files` ord 15)

- New **optional per-domain purpose file** `structural_results` — structural analysis +
  design results in long/tidy form. One file **per analysis domain**, shared by every
  producer in it (ETABS/CSi/SAP2000/TSD write the same schema); non-structural domains
  get their own `eav.{domain}_results.parquet`. Columns: `object_index, element_name, location,
  result_type, load_case, component, position_label, station, step, value, value_text`.
- **Backward-compatible, no `meta.schema_version` bump**: no existing table changed, and
  a consumer that doesn't recognise the file simply skips it (it's `required=false` in
  `bundle_files`). Design, the 8 ETABS/TSD type mappings, locked decisions and caveats
  live in `docs/rationale/structural-results.md`.

## schema_version 5 (pre-pin) — vocabulary harmonization

First version published as a standalone spec (extracted from the producers'
`envelope_catalog.h` / managed `EnvelopeWriter`).

**Relations**
- `IN_NETWORK` (15) **retired** → collapsed into `IN_SYSTEM` (14); the CONTAINER
  `subtype` (`MEP System` | `Network`) now distinguishes authored vs derived MEP groupings.
- `IN_SPACE` (13) **retired** — no ODA element→space membership API; spaces ship as objects (eav).
- `IN_LINE` (16), `IN_GROUP` (17), `IN_ASSEMBLY` (18), `IN_SUBASSEMBLY` (19),
  `HOSTED_ON` (22), `XREF` (20) **retired** — vocabulary-only, never emitted.
- `SOLID` (2) kept as **reserved** — planned for Rhino / Civil3D (solid vs display mesh).
- All retired ids are kept in place and never reused.

**Node kinds**
- `COLLECTION` (6) **retired** → folded into `CONTAINER` (7) with `subtype='Collection'`.
  CONTAINER is now the single grouping node; `subtype` is its only discriminator.
- `MATERIAL` (3) / `COLOR` (4) kept split — they drive different viewer render modes.

**Nodes table**
- Added `subtype` column; retired the `units`-as-subtype overload.
- Fixed-column design retained (nodes are bounded structural scaffolding; unbounded
  metadata stays on objects via eav).

Live: 15 relations, 6 node kinds.
