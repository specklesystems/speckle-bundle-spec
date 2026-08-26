# Bundle spec versioning (25.08.2026)

How `schema_version` is bumped, where the number lives, and what has to be
re-vendored so every producer stamps the same value.

## One number, written twice

`schema_version` **is** the package semver (`1.0.0`), stored as a string.

| Copy | Lives in | Read by |
|---|---|---|
| **`schema_version`** (semver string) | `spec/bundle-spec.sql` — the `INSERT INTO meta VALUES ('<x.y.z>', …)` row | codegen → every generated target (`SchemaVersion` / `kSchemaVersion` / `SCHEMA_VERSION`, all strings); producers stamp it into `{base}.envelope.meta.parquet` |
| **package version** | `package.json` + `package-lock.json` | `publish.mjs` → `dist/bundle-spec.lock.json`, artifact filenames (`bundle-spec-cpp-<version>.tar.gz`) |

Rule: the two copies are **equal** — `npm test` (conformance) and `npm run publish:artifacts`
fail on mismatch. Major = breaking meaning change (below); minor/patch are free for additive
or doc-only changes and *do* get stamped into bundles, so a reader can tell `1.1.0` from `1.0.0`.

Consumers never gate on the value (the validator only checks columns are present); the
number is provenance. That still matters: it's the only thing that tells a reader which
catalog a bundle was written against.

## When to bump `schema_version`

Bump when the **meaning** of an existing bundle changes, i.e. a consumer reading an old
bundle with the new vocabulary would be wrong:

- a rel / node-kind id changes meaning, or a retired id is un-retired
- a column is removed or its type/semantics change
- a file in `bundle_files` is renamed, or its optional/required status flips
- precedence rules change (e.g. material/colour ladders)

Do **not** bump the **major** for purely additive changes — new rel/kind ids, new optional
columns, new optional files, comment/rationale edits. Log them under `## unreleased
(schema_version <x.y.z>, additive)` in `CHANGELOG.md`; they ship as a minor/patch release. Retire ids in place (`status='retired'`), never reuse.

## Bump checklist — this repo

1. `spec/bundle-spec.sql`
   - `INSERT INTO meta VALUES ('<x.y.z>', …)` (line ~38) — the actual source
   - header comment `(schema_version <x.y.z>)` (line 2)
2. `package.json` `"version"` → the same `<x.y.z>`, then `npm install --package-lock-only` so
   `package-lock.json` follows (it is tracked, CI `npm ci` fails on mismatch). Conformance
   fails if the two strings differ.
3. `npm run generate` — regenerates `generated/{ts,cpp,csharp,python}` and
   `docs/reference.md`. Confirm the stamp landed:
   ```bash
   grep -rn -E "SCHEMA_VERSION = |SchemaVersion = |kSchemaVersion = " generated   # all quoted "<x.y.z>"
   ```
4. `CHANGELOG.md` — close the `## unreleased` block into `## schema_version <x.y.z> — <title>`
   and open a fresh `## unreleased (schema_version <x.y.z>, additive)`.
5. `README.md` — the "current vocabulary (schema_version <x.y.z>)" line at the bottom, and
   the `CONTEXT.md` glossary entry.
6. `npm test && npm run check` — conformance + no drift in `generated/`.
7. Commit spec + generated + docs together (one commit, e.g. `chore: pin schema version to <x.y.z>`).
8. `npm run publish:artifacts` → `dist/bundle-spec.lock.json` + cpp tarball + python
   package. The lockfile is deterministic (same spec ⇒ byte-identical), so this can be
   re-run by anyone from the commit.

## Downstream — where the number is copied

Every consumer gets the value one of three ways. Check all of them after a bump.

### A. Linked from a sibling checkout (nothing to copy)

| Repo | Wiring |
|---|---|
| `speckle-sharp-sdk` | `src/Speckle.Sdk.Parquet/Speckle.Sdk.Parquet.csproj` `<Compile Include="../../../speckle-bundle-spec/generated/csharp/BundleSpec.cs">` — `EnvelopeWriter.cs` stamps `SpecBundle.SchemaVersion` |
| `speckle-converters` dispatch (Python) | `dispatch/pyproject.toml` depends on `speckle-bundle-spec` via `[tool.uv.sources] path = "../vendor/speckle-bundle-spec"` (the root `pyproject.toml` here makes `generated/python` installable as `speckle_bundle_spec`); `ledger.py` imports `SCHEMA_VERSION` — the submodule SHA is the pin |
| `speckle-converters` native (`rvextract`, `nwextract`) | CMake `BUNDLE_SPEC` defaults to `../../../speckle-bundle-spec`; container builds point it at the extracted published artifact and set `-DBUNDLE_SPEC_EXPECT_VERSION=<x.y.z>` (build fails on mismatch) |

Action: pull the sibling checkout; for the unified image, update the default in
`speckle-converters/mise.toml` (`build` task: `BUNDLE_SPEC_VERSION:-<x.y.z>`) and the
artifact it fetches. `BUNDLE_SPEC_EXPECT_VERSION` compares the package version string
(`"1.0.0"`) — now the same value as `kSchemaVersion`.

### B. Vendored copy + pin file (re-vendor + verify)

| Repo | Vendored files | Pin |
|---|---|---|
| `specklepy` | `src/specklepy/bundle/spec/bundle_spec.py`, `bundle_schemas.py`, `bundle_cols.py` ← `generated/python/` | `src/specklepy/bundle/spec/BUNDLE_SPEC_PIN.json` (`version`, `schemaVersion`, `specHash`) |
| `speckle-converters` | `vendor/speckle-bundle-spec` and `vendor/specklepy` are git submodules — bump the submodule SHAs | CI job `bundle-spec-pin` runs `verify-pin.mjs --cpp dist/cpp`|

Re-vendor recipe (specklepy):
```bash
cp speckle-bundle-spec/generated/python/bundle_{spec,schemas,cols}.py specklepy/src/specklepy/bundle/spec/
# update version / schemaVersion / specHash in BUNDLE_SPEC_PIN.json from dist/bundle-spec.lock.json
cd speckle-bundle-spec && npm run verify-pin -- --python ../specklepy/src/specklepy/bundle/spec
```

### C. Hand-written literal (grep and edit)

| Repo | Location |
|---|---|
| `speckle-sketchup` | `speckle_connector_3/src/artifacts/envelope_writer.rb` `SCHEMA_VERSION = '<x.y.z>'` + comment in `artifacts/vocab.rb` |

These have no drift guard. Find them across the working set with:
```bash
grep -rn -E "SCHEMA_VERSION\s*=\s*['\"][0-9.]+|SchemaVersion\s*=\s*\"[0-9.]+|kSchemaVersion\s*=\s*\"[0-9.]+" \
  --include='*.rb' --include='*.py' --include='*.cs' --include='*.h' --include='*.ts' . \
  | grep -vE "node_modules|/bin/|/obj/|/dist/"
```
Every hit must show the new string — and every producer must write `schema_version` as a
string column (VARCHAR / UTF8), not int32.

## Not this number

`Version.schemaVersion` on the server GraphQL API (`ENVELOPE_BUNDLE_SCHEMA_VERSION = 3` in
`speckle-server/.../modules/data/domain/types.ts`, `QUERYABLE_SCHEMA_VERSION = 3` in
frontend-3, `schemaVersion === 3` in the WebGPU viewer) is the **server-side storage-format
flag** ("this version has a parquet bundle"), not the bundle catalog version. It does not
move when `schema_version` moves. Don't touch it during a spec bump.

## Verify after a bump

- `speckle-bundle-spec`: `npm run check` green, `dist/bundle-spec.lock.json` shows the new `schemaVersion`.
- Send a model from each producer and read `{base}.envelope.meta.parquet`:
  ```sql
  SELECT schema_version, produced_by, sdk_name FROM 'x.envelope.meta.parquet';
  ```
  All producers must report the same `schema_version`.
- `npm run validate -- <bundle-dir>` passes on a fresh bundle from each producer.
