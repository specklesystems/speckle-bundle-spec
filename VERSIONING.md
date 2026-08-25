# Bundle spec versioning (25.08.2026)

How `schema_version` is bumped, where the number lives, and what has to be
re-vendored so every producer stamps the same value.

## The two numbers

| Number | Lives in | Read by |
|---|---|---|
| **`schema_version`** (integer) | `spec/bundle-spec.sql` — the `INSERT INTO meta VALUES (<n>, …)` row | codegen → every generated target; producers stamp it into `{base}.envelope.meta.parquet` |
| **package version** (semver) | `package.json` + `package-lock.json` | `publish.mjs` → `dist/bundle-spec.lock.json`, artifact filenames (`bundle-spec-cpp-<version>.tar.gz`) |

Rule: **package major = `schema_version`** (`schema_version 1` ⇒ `1.x.y`). Minor/patch are
free for additive or doc-only changes that don't bump the schema. npm rejects a bare `"1"`, so
`1.0.0` is the shortest valid form.

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

Do **not** bump for purely additive changes — new rel/kind ids, new optional columns, new
optional files, comment/rationale edits. Log them under `## unreleased (schema_version <n>,
additive)` in `CHANGELOG.md` instead. Retire ids in place (`status='retired'`), never reuse.

## Bump checklist — this repo

1. `spec/bundle-spec.sql`
   - `INSERT INTO meta VALUES (<n>, …)` (line ~37) — the actual source
   - header comment `(schema_version <n>)` (line 2)
2. `package.json` `"version"` → `<n>.0.0`, then `npm install --package-lock-only` so
   `package-lock.json` follows (it is tracked, CI `npm ci` fails on mismatch).
3. `npm run generate` — regenerates `generated/{ts,cpp,csharp,python}` and
   `docs/reference.md`. Confirm the stamp landed:
   ```bash
   grep -rn -E "SCHEMA_VERSION = |SchemaVersion = |kSchemaVersion = " generated
   ```
4. `CHANGELOG.md` — close the `## unreleased` block into `## schema_version <n> — <title>`
   and open a fresh `## unreleased (schema_version <n>, additive)`.
5. `README.md` — the "current vocabulary (schema_version <n>)" line at the bottom.
6. `npm test && npm run check` — conformance + no drift in `generated/`.
7. Commit spec + generated + docs together (one commit, e.g. `chore: pin schema version to <n>`).
8. `npm run publish:artifacts` → `dist/bundle-spec.lock.json` + cpp tarball + python
   package. The lockfile is deterministic (same spec ⇒ byte-identical), so this can be
   re-run by anyone from the commit.

## Downstream — where the number is copied

Every consumer gets the value one of three ways. Check all of them after a bump.

### A. Linked from a sibling checkout (nothing to copy)

| Repo | Wiring |
|---|---|
| `speckle-sharp-sdk` | `src/Speckle.Sdk.Parquet/Speckle.Sdk.Parquet.csproj` `<Compile Include="../../../speckle-bundle-spec/generated/csharp/BundleSpec.cs">` — `EnvelopeWriter.cs` stamps `SpecBundle.SchemaVersion` |
| `speckle-converters` native (`rvextract`, `nwextract`) | CMake `BUNDLE_SPEC` defaults to `../../../speckle-bundle-spec`; container builds point it at the extracted published artifact and set `-DBUNDLE_SPEC_EXPECT_VERSION=<n>` (build fails on mismatch) |

Action: pull the sibling checkout; for the unified image, update **every** `BUNDLE_SPEC_VERSION`
source in speckle-converters — `.github/workflows/ci.yml` and `full-rhino-ci.yml` (`env:` block,
fed to the `image` job as a build-arg) and `mise.toml` (`build` task default) — plus the artifact
it fetches. A missed one fails the image build with `bundle-spec pin MISMATCH: want <old>,
artifact is <new>`. `grep -rn BUNDLE_SPEC_VERSION .github mise.toml docker` must show only the new value. `BUNDLE_SPEC_EXPECT_VERSION` compares the **package** version string
(`"1.0.0"`), not the integer `schema_version`.

### B. Vendored copy + pin file (re-vendor + verify)

| Repo | Vendored files | Pin |
|---|---|---|
| `specklepy` | `src/specklepy/bundle/spec/bundle_spec.py`, `bundle_schemas.py`, `bundle_cols.py` ← `generated/python/` | `src/specklepy/bundle/spec/BUNDLE_SPEC_PIN.json` (`version`, `schemaVersion`, `specHash`) |
| `speckle-converters` | `vendor/speckle-bundle-spec` and `vendor/specklepy` are git submodules — bump the submodule SHAs | CI job `bundle-spec-pin` runs `verify-pin.mjs --cpp dist/cpp`; `dispatch/src/dispatch/ledger.py` has a `schema_version: int = <n>` default that must be updated by hand |

Re-vendor recipe (specklepy):
```bash
cp speckle-bundle-spec/generated/python/bundle_{spec,schemas,cols}.py specklepy/src/specklepy/bundle/spec/
# update version / schemaVersion / specHash in BUNDLE_SPEC_PIN.json from dist/bundle-spec.lock.json
cd speckle-bundle-spec && npm run verify-pin -- --python ../specklepy/src/specklepy/bundle/spec
```

### C. Hand-written literal (grep and edit)

| Repo | Location |
|---|---|
| `speckle-sketchup` | `speckle_connector_3/src/artifacts/envelope_writer.rb` `SCHEMA_VERSION = <n>` + comment in `artifacts/vocab.rb` |
| `speckle-converters` | `dispatch/src/dispatch/ledger.py` default arg (see above) |

These have no drift guard. Find them across the working set with:
```bash
grep -rn -E "SCHEMA_VERSION\s*=\s*[0-9]+|SchemaVersion\s*=\s*[0-9]+|kSchemaVersion\s*=\s*[0-9]+|schema_version: int = [0-9]+" \
  --include='*.rb' --include='*.py' --include='*.cs' --include='*.h' --include='*.ts' . \
  | grep -vE "node_modules|/bin/|/obj/|/dist/"
```
Every hit must show the new number.

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
