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
CONTEXT.md                glossary — the ubiquitous language of the bundle
docs/reference.md         human reference (generated)
docs/adr/                 architecture decision records (why the format is shaped this way)
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

## Publish and pin

`generated/` is the source of truth for consumers, but a bare sibling checkout gives no
version guarantee. `npm run publish:artifacts` packages the **cpp** and **python** targets
as versioned, checksummed, self-describing artifacts so the native C++ extractors
(`rvextract`/`nwextract`) and `specklepy` provably build against **one** spec version.

```bash
npm run publish:artifacts        # → dist/
```

produces (deterministic — same spec ⇒ byte-identical lockfile):

```
dist/bundle-spec.lock.json           canonical pin: version, specHash (sha256 of the SQL), per-file sha256
dist/bundle-spec-cpp-<version>.tar.gz fetchable C++ artifact; extracts to generated/cpp/ (+ bundle_spec_version.h)
dist/python/                          installable `speckle-bundle-spec` package (+ _version.py)
```

Consumers **pin** against `dist/bundle-spec.lock.json`, and CI enforces no drift:

```bash
npm run verify-pin -- --cpp    <dir>   # <dir> exposes generated/cpp/*.h  (extracted artifact or a checkout)
npm run verify-pin -- --python <dir>   # <dir> holds the vendored *.py    (specklepy's bundle/spec)
```

- **C++**: the extractor build sets `-DBUNDLE_SPEC=<extracted artifact>` and, to enforce the
  version, `-DBUNDLE_SPEC_EXPECT_VERSION=<x>` (fails the build on mismatch — see
  `speckle-oda/native/cmake/AssertBundleSpecPin.cmake`).
- **Python**: `specklepy/src/specklepy/bundle/spec/` vendors the target and records the pin in
  `BUNDLE_SPEC_PIN.json`; CI runs `verify-pin -- --python` against that dir.

## Rules

- **Edit `spec/bundle-spec.sql`, never `generated/`.** CI (`npm run check`) fails on stale output.
- **Retire ids in place, never reuse them** (`status='retired'`). Gaps are intentional.
- Short semantics live in the spec (as columns); long-form rationale lives in `docs/rationale/`.

See `docs/reference.md` for the current vocabulary (schema_version 1), and
`VERSIONING.md` for how to bump `schema_version` and what to re-vendor downstream.
