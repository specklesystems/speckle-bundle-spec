# Changelog

Schema versions track `meta.schema_version` in `spec/bundle-spec.sql`.

## unreleased (schema_version 5, additive)

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
