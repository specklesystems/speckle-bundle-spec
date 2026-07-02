# Structural results (`structural_results` purpose file)

> Long-form design + caveats for the `structural_results` table. The machine reference
> (columns, per-column notes) is generated into `../reference.md` from `spec/bundle-spec.sql`;
> this essay owns the **why**, the **type mappings**, the **locked decisions**, and the
> **caveats / out-of-scope**. Status: **schema finalized after structural-engineer review** —
> all 8 ETABS analysis types + TSD design outputs map onto one shape.

## What it is

An **optional, per-domain purpose file** alongside the core bundle:

```
{base}.eav.structural-results.parquet
```

Structural analysis + design results in **long/tidy** form — one scalar per row. The columns
are **orthogonal axes**; each result type lights up only the axes it has (everything else is
`NULL`). A consumer never special-cases a "kind of table": it filters
`WHERE result_type = …` and reads the non-null columns.

Two rules define its scope:

1. **One file per analysis _domain_, shared by every producer in it.** ETABS/CSi, SAP2000 and
   **TSD** (Tekla Structural Designer) all write **this same schema**. A *non-structural* domain
   (environmental / daylight / energy from Grasshopper, thermal, …) gets its **own**
   `eav.{domain}-results.parquet` — those have different axes (hour, weather, metric) and
   jamming them here would mean per-domain column sprawl.
2. **Not folded into `eav.eav`.** Results carry extra axes (load case, station, step) that the
   flat eav's single `(object, path, value)` triple can't hold without baking them into the
   property path (`frameForces.EQx.sta_1.5.step_237.M3`). That makes nearly every path unique —
   for a 5,000-member time-history, **billions** of path-dictionary entries, unqueryable without
   string-parsing. As **typed columns**, a value is one tidy row and "max M3 per column under EQx"
   is a normal `GROUP BY`.

## Schema (11 columns)

`object_index, element_name, location, result_type, load_case, component, position_label,
station, step, value, value_text` — see `spec/bundle-spec.sql` for types + per-column comments.

### Three identity shapes

The correlation back to geometry is `object_index → objects.application_id`.

| shape | who | identity columns |
|---|---|---|
| **object-level** | frame forces, joint reactions | `object_index` set (via a *name → applicationId* map — CSi keys results by element **name**, objects are interned by **applicationId**) |
| **group-level** | pier forces, spandrel forces | `element_name` set (a **named group of walls**, not an interned object), `location` = story |
| **model / story-level** | base reaction, modal period, story drift, story force | `object_index` + `element_name` both `NULL`; identity is `location` (story) and/or `step` (mode), or blank = whole-model |

### `value` vs `value_text`

Exactly **one** is set per row:

- **numeric result** → `value` set, `value_text` `NULL` (all analysis results; numeric design outputs like a utilization ratio).
- **non-numeric verdict** → `value` `NULL`, `value_text` set (a design check returning `PASS`/`FAIL`, `OK`/`Over`).

`value_text` is `NULL` for every ETABS analysis row — it exists so the **same file** can hold TSD
design verdicts later with no schema change.

## The 8 ETABS types + TSD → schema

| result_type | object_index | element_name | location | position_label | station | step | component | value | value_text |
|---|---|---|---|---|---|---|---|---|---|
| `frameForce` | Elm→appId | – | – | – | ElmSta | StepNum | P,V2,V3,T,M2,M3 | num | – |
| `jointReaction` | Elm→appId | – | – | – | – | StepNum | F1,F2,F3,M1,M2,M3 | num | – |
| `baseReaction` | – | – | – | – | – | StepNum | FX,FY,FZ,MX,MY,MZ | num | – |
| `modalPeriod` | – | – | – | – | – | Mode | Period,Frequency,CircFreq,Eigenvalue | num | – |
| `pierForce` | – | PierName | StoryName | Top/Bottom | – | – | P,V2,V3,T,M2,M3 | num | – |
| `spandrelForce` | – | SpandrelName | StoryName | Top/Bottom | – | – | P,V2,V3,T,M2,M3 | num | – |
| `storyDrift` | – | – | Story | X/Y | – | StepNum | drift | num | – |
| `storyForce` | – | – | Story | Top/Bottom | – | – | axial,majorShear,minorShear,torsion,majorMoment,minorMoment | num | – |
| `utilization` (TSD) | member→appId | – | – | – | – | – | ratio | 0.87 | – |
| `designCheck` (TSD) | member→appId | – | – | – | – | – | status | – | `PASS` |

(`–` = null.)

## Locked decisions (structural-engineer review)

These were the open questions; the answers are now baked into the schema:

1. **Piers / spandrels are NOT first-class objects** — "think of them as a collection / group of
   wall objects." → `object_index = NULL`, identity in `element_name` (+ `location` = story). We do
   **not** intern them or attach geometry.
2. **Story drift = drift per direction per storey is enough** — ETABS returns
   `Direction, Drift, Label, X, Y, Z`; we keep `Drift` per `Direction` (`position_label` = X/Y) and
   **drop `Label` and the `X/Y/Z` coordinates**.
3. **Top / Bottom is a `position_label`** — a categorical column, not a numeric station and not two
   synthetic stations.

## Gating

Opt-in: produced only when the user selected load cases/combos **and** result types in the publish
settings, **and** the model is **locked** (analysis has run). A results-extraction failure (unlocked
model, case not finished) is **logged and skipped** so geometry + properties still send.

## Caveats & future extension

Parquet is additive-safe: a **new nullable column is backward-compatible** (old rows read `NULL`).
The parts that would break — renaming/retyping existing columns — are what this review locked down.
So the following, if ever needed, are clean **add-later** columns, not redesigns:

- **Per-result `unit`** — if drift (dimensionless), force (kN) and displacement (mm) can't all be
  inferred from `component` + the model-wide unit set on the version root (`forceUnits`, …).
- **Real `time`** for time-history — today `step` is an index, not seconds.
- **Envelope min/max marker** — many combos → if consumers want pre-enveloped max/min per member
  distinguished from a specific step (today it would ride on `load_case` naming).

### Explicitly out of scope (different shape, not a column here)

**Dense per-shell stress _fields_** — stress at every node across a wall/slab face, top/bottom fiber,
layered sections (a contour/field over an area, not one scalar per element). This table is
**aggregate/per-element** (a pier is one group-level result, matching the "group of walls" model). If
full shell **stress contours** are ever needed, that is field data belonging with geometry — a
separate artefact, not a column here.

## Consumer notes

- Join object-level results to geometry/properties: `structural_results.object_index = objects.object_index`.
- Group-level: `element_name` (pier/spandrel) is not an object; don't try to join it.
- Model/story-level rows have `object_index` + `element_name` `NULL`; group by `location` (story) / `step` (mode).
- `result_type` / `load_case` / `component` are dictionary-encoded → cheap to filter/group.
- Numeric result = `value`; design verdicts = `value_text` (TSD).

## Producer status

- **Live** (CSi/ETABS): `frameForce`, `jointReaction`, `baseReaction`, `modalPeriod`.
- **Designed, ready to wire** (this review): `pierForce`, `spandrelForce`, `storyDrift`, `storyForce`.
- **Future domain**: TSD (`utilization`, `designCheck`, member forces) reuses this exact file.
