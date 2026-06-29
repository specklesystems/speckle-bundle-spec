---
status: accepted
---

# Nodes are fixed-column structural scaffolding, not an eav

The `nodes` table keeps a **fixed column schema** while objects get an unbounded
`eav` store. This asymmetry is deliberate: objects carry *unbounded, source-variable*
metadata (every Revit parameter, every IFC attribute), whereas nodes are synthetic
*structural scaffolding* whose attributes are a small, bounded set of structural
scalars (transform, elevation, argb/PBR, subtype). The boundary rule — **anything
source-variable or arbitrary-key belongs on an object (eav); nodes hold only bounded
structural attributes** — is what keeps "just add a column when a genuinely new
structural scalar appears" safe indefinitely. When this was written, no near-term
node attribute breached the rule.

## Considered options

- **`node_eav` sidecar** (give nodes the same eav treatment as objects). Rejected:
  it's speculative machinery for extensibility we can't name, and it regresses the
  one genuinely hot read — the per-instance `transform/units/def_ref` bulk scan in
  `buildDatFromBundle.ts` (100k–1M instances on load) — by forcing an eav pivot. The
  cold node reads (name/elevation/subtype, tens of rows) wouldn't care, but the hot
  one would.
- **A VARIANT / JSON column** ("drop whatever in"). Rejected: it reintroduces exactly
  what the flat eav model exists to kill — per-read deserialization, loss of the
  self-describing `paths` catalog, and a *second* attribute model in one bundle. In
  the Arrow C++ toolchain "VARIANT" realistically means a JSON-text column (no
  shredding), the weakest form. node_eav would deliver the same "no schema change"
  ergonomics without these costs — but we don't need either.

## Consequences

- Adding a new node *kind* is free (an integer + a `node_kinds` row). Adding a new
  node *property* means appending a nullable column — cheap and non-breaking for
  name-keyed readers, and we own both producers and both consumers.
- The `units`-as-subtype overload is replaced by a real `subtype` column (the only
  change to the table this entailed).
- **Revisit trigger** (sunset condition): a node kind needs open-ended,
  source-dependent metadata that is *not* reducible to its member objects. Until then,
  columns win.
