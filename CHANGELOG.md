# Changelog

Schema versions track `meta.schema_version` in `spec/bundle-spec.sql`.

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
