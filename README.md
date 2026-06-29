# speckle-bundle-spec

Single source of truth for the **Speckle bundle format** — the flat `eav` data
store, the `envelope` graph (nodes + typed relations), and the `geometries`
blobs that producers emit and the viewer / server consume.

The spec is **executable SQL**. The bundle is a set of DuckDB-readable parquet
tables, so its schema is described in the language its consumers already speak.

```
spec/bundle-spec.sql      ← THE SOURCE OF TRUTH (edit this)
codegen/                  runs the spec in DuckDB, SELECTs the catalogs, templates outputs
generated/{cpp,csharp,ts} constants for producers & consumers — NEVER hand-edit
docs/reference.md         human reference (generated)
docs/rationale/           long-form "why" essays (hand-written; link to the reference)
validator/                checks a real bundle against the spec
tests/conformance/        guards the spec's own invariants
```

## How it stays in sync

`bundle-spec.sql` holds two things in one file:

- **Table shapes** as `CREATE TABLE` DDL (+ `COMMENT ON` for per-column semantics).
- **The semantic catalogs** (`rel_types`, `node_kinds`, `bundle_files`) as
  `CREATE TABLE … INSERT`, where the meaning (`description`, `why`, `status`,
  `emitted_by`, `ord_semantics`) rides as **columns**.

Codegen doesn't parse SQL — it **executes** the spec in DuckDB and `SELECT`s.
The same engine validates a bundle. Three former copies of the truth
(producer `envelope_catalog.h`, the managed `EnvelopeWriter`, the TS consumers)
collapse to generated artifacts derived from this one file.

```bash
npm run generate    # refresh generated/ + docs/reference.md from the spec
npm test            # conformance: spec invariants (ids unique, namespaces, …)
npm run validate -- <bundle-dir>   # check a real bundle against the spec
npm run check       # CI: fail if generated/ is stale vs the spec
```

Requires the `duckdb` CLI on `PATH` (or set `DUCKDB_BIN`).

## Rules

- **Edit `spec/bundle-spec.sql`, never `generated/`.** CI (`npm run check`) fails on stale output.
- **Retire ids in place, never reuse them** (`status='retired'`). Gaps are intentional.
- Short semantics live in the spec (as columns); long-form rationale lives in `docs/rationale/`.

See `docs/reference.md` for the current vocabulary (schema_version 5).
