# Changelog

Schema versions track `meta.schema_version` in `spec/bundle-spec.sql`.

## unreleased (schema_version 5, additive)

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

## schema_version 5 — vocabulary harmonization

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
