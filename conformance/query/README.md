# Query conformance suite

The portable test that every bundle query engine runs: the server Query Engine, the
browser attach path (`@speckle/ts-sdk`), `Speckle.Sdk.Query` (.NET) and the specklepy
`[query]` extra. It pins the **mounted schema** (the replica invariant) and a set of
golden query results over one committed synthetic bundle. Authority vests in this suite
plus the contract doc in the server Query Engine module
(`packages/server/modules/queryEngine/docs/query-conformance-contract.md` in
speckle-server-internal); the engines conform, they do not legislate.

```
bundle/          the synthetic bundle (16 parquet files, ~54 KB) — every bundle_files
                 view incl. the type tables and catalogs; eav spans 3 row groups;
                 geometries is written as 2 shards
fixture.sql      the deterministic recipe the bundle is built from (run after the spec DDL)
schema.json      the mounted-schema expectation (generated from the spec)
cases.json       golden (sql, expected) pairs, all fully ORDER BY-ed
local/           side files for the local-data-join cases (read_csv against the bundle)
harness.mjs      loader, mount plan, result comparison — pure JS, vendored by the JS engines
```

Rebuild with `npm run build:query-fixture` (needs the `duckdb` CLI). The reference runner,
`tests/query-conformance/run.mjs`, is part of `npm test`.

## The contract an engine must satisfy

1. **Alias → schema.** Each attached ref mounts under its alias as a DuckDB schema; the
   alias matches `^[a-zA-Z0-9_]{3,}$`. Queries address views as `"<alias>"."<view>"`.
2. **Filename → view.** `{base}.eav.<view>.parquet` and `{base}.envelope.<view>.parquet`
   mount as `<view>`; the first file wins on a duplicate view name; a derived name outside
   `^[a-zA-Z0-9_]+$` is skipped. Anything else (geometry shards
   `{base}.geometries[.N].parquet`, `.viewer.dat`, unknown sidecars) is **never mounted**.
3. **`object_properties`.** Every mounted bundle also exposes
   `"<alias>"."object_properties"`: instance `eav` rows `UNION ALL` type-scoped
   `type_eav` rows resolved through `object_type` (`harness.mjs#objectPropertiesViewSql`
   is the DDL).
4. **Readonly.** Artifact files are never mutated. Whether an engine also lets SQL read
   caller-local files is a *capability*, not part of the invariant (see below).

`schema.json` is the machine-readable form of 1–3 for this bundle: the file list, the
exact view set, each view's columns in spec order, the files that must not be mounted,
and the `object_properties` row count.

## Running the suite in an engine

- Mount `bundle/` under alias `gold` through the engine's normal attach path.
- Assert `schema.json`: the mounted view set equals `views` (no more, no fewer), each
  view's columns match in order, `object_properties` has `objectPropertiesRowCount`
  rows, and no view exists for any file in `notMounted`.
- For each case in `cases.json`: substitute `{{local_dir}}` with the absolute path of
  `local/`, run `sql`, and compare `{ columns, rows }` to `expected` under the
  normalisation in `harness.mjs#normalizeCell` (numbers-as-text → numbers, `'true'` →
  `true`, 1e-6 relative tolerance on doubles). Column names and row order are part of
  the contract.
- A case with `requires` lists engine capabilities it needs. An engine that lacks one
  **skips the case and says so** (a logged skip, never a silent pass):
  - `local_file_reads` — SQL may read files outside the bundle (`read_csv`,
    `read_parquet`). The SDK-local engines have it; the server Query Engine deliberately
    does not (its lockdown allow-lists exactly the bundle files).

Result-level parity is best-effort across DuckDB versions; the schema is the invariant.
Breaking a golden is a deliberate fixture change here plus a ledger entry, never a
per-engine patch.

## Distribution

Consumers vendor this directory the way specklepy vendors `generated/python`:
`npm run publish:artifacts` lists every file under `conformance/query/` in
`dist/bundle-spec.lock.json` (target `queryConformance`), and
`npm run verify-pin -- --query-conformance <vendored dir>` checks a vendored copy against it.
