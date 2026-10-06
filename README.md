# speckle-bundle-spec

Single source of truth for the **Speckle bundle format** — the flat `eav` data
store, the `envelope` graph (nodes + typed relations), and the `geometries`
blobs that producers emit and the viewer / server consume.

The spec is **executable SQL**. The bundle is a set of DuckDB-readable parquet
tables, so its schema is described in the language its consumers already speak.

```
spec/bundle-spec.sql      ← THE SOURCE OF TRUTH (edit this)
codegen/                  runs the spec in DuckDB, SELECTs the catalogs, templates outputs into packages/
packages/ts/              @speckle/bundle-spec — TS catalog (src/, generated) + spec/bundle-spec.sql (copy) + package.json
packages/conformance/     @speckle/bundle-spec-conformance — validate-bundle bin, query-conformance suite
packages/python/          speckle-bundle-spec — pyproject.toml + speckle_bundle_spec/ (generated modules)
packages/csharp/          Speckle.Bundle.Spec — csproj + generated *.cs
packages/cpp/             header tarball — CMakeLists.txt + include/ (generated headers)
scripts/                  release gate, artifact build, consumer smoke (what CI runs)
GLOSSARY.md               glossary — the ubiquitous language of the bundle
docs/reference.md         human reference (generated)
docs/adr/                 architecture decision records: 0001 nodes, 0002 executable SQL, 0003 generated schemas + validation, 0004 registry packages (pointer to the atlas spec)
docs/rationale/           long-form "why" essays (hand-written; link to the reference)
tests/                    spec invariants, validator, query-conformance runner, release gate
```

Generated code is **committed** inside each package; the manifests beside it are
hand-written, ordinary files of their ecosystem. `npm run check` fails when the
generated code is stale against the spec.

## Install

One version everywhere: every artifact is published at `meta.schema_version`
(`VERSIONING.md`; decision: [ADR-0004](docs/adr/0004-distributed-as-registry-packages.md)).
Pin it exactly.

| Ecosystem | Install |
|---|---|
| TypeScript / Node | `npm i @speckle/bundle-spec@1.4.0` — `import { Rel, NodeKind, SCHEMA_VERSION } from '@speckle/bundle-spec'`; the SQL is at `@speckle/bundle-spec/spec/bundle-spec.sql` |
| Tests / CI (any ecosystem) | `npm i -D @speckle/bundle-spec-conformance@1.4.0` — `npx validate-bundle <bundle-dir>`; the query-conformance suite is `import { loadSuite } from '@speckle/bundle-spec-conformance'` over the package's `query/` directory. Needs the `duckdb` CLI on `PATH` (or `DUCKDB_BIN`) |
| Python | `speckle-bundle-spec==1.4.0` — `from speckle_bundle_spec import Rel, SCHEMA_VERSION` (specklepy users keep `specklepy.bundle.spec`) |
| .NET | `<PackageReference Include="Speckle.Bundle.Spec" Version="[1.4.0]" />` — namespace `Speckle.Bundle.Spec`, `BundleSpec.SchemaVersion` |
| C++ (CMake ≥ 3.14) | `FetchContent_Declare(bundlespec URL https://github.com/specklesystems/speckle-bundle-spec/releases/download/1.4.0/speckle-bundle-spec-cpp-1.4.0.tar.gz URL_HASH SHA256=<from the .sha256 asset>)`, `FetchContent_MakeAvailable(bundlespec)`, link `bundlespec::bundlespec`; `bundlespec_VERSION` is the fetched version, `bundle_schemas.h` needs Arrow on the consumer's side |

The private Verdaccio registry carries the two npm packages too (it does not proxy
`@speckle/*`); the server resolves them from there like every other `@speckle/*` package.

## Working on the spec

```bash
npm install         # workspaces: packages/ts, packages/conformance (+ typescript)
npm run generate    # refresh packages/*/ + docs/reference.md from the spec
npm test            # spec invariants, validator, query conformance, release gate
npm run check       # CI: fail if generated code is stale vs the spec
npm run validate -- <bundle-dir>   # check a real bundle against the spec
npm run build:query-fixture        # rebuild packages/conformance/query/bundle from fixture.sql
scripts/build-artifacts.sh && scripts/smoke-artifacts.sh   # the PR dry build, locally
```

Requires the `duckdb` CLI on `PATH` (or set `DUCKDB_BIN`); the dry build also needs
`uv`, `dotnet` and `cmake` with a C++17 compiler.

Releasing is tagging: `VERSIONING.md` has the bump checklist and what the release
workflow does.

## Building a consumer against an unreleased spec

Native overrides, nothing bespoke — each points the consumer at your working copy:

- **npm**: `npm link` in `packages/ts` (after `npm run build`) and/or
  `packages/conformance`, then `npm link @speckle/bundle-spec` in the consumer; or
  `npm i <path>/packages/ts` for a file dependency.
- **Python**: `pip install -e <path>/packages/python` (or `uv pip install -e …`), or a
  `[tool.uv.sources] speckle-bundle-spec = { path = "…/packages/python", editable = true }`
  override in the consumer's `pyproject.toml`.
- **.NET**: `dotnet pack packages/csharp -o <feed-dir>` and add `<feed-dir>` as a package
  source (`nuget.config` or `dotnet nuget add source`), bumping `<Version>` to a
  prerelease if the consumer already restored the same number; or temporarily swap the
  `PackageReference` for a `ProjectReference` to `packages/csharp/Speckle.Bundle.Spec.csproj`.
- **C++**: configure the consumer with
  `-DFETCHCONTENT_SOURCE_DIR_BUNDLESPEC=<path>/packages/cpp` — FetchContent uses that
  directory instead of downloading the tarball, hash check skipped.

## Rules

- **Edit `spec/bundle-spec.sql`, never generated code.** CI (`npm run check`) fails on
  stale output. Manifests (`package.json`, `pyproject.toml`, `.csproj`, `CMakeLists.txt`)
  are hand-written.
- **Retire ids in place, never reuse them** (`status='retired'`). Gaps are intentional.
- Short semantics live in the spec (as columns); long-form rationale lives in `docs/rationale/`.

See `docs/reference.md` for the current vocabulary (schema_version 1.4.0), and
`VERSIONING.md` for how to bump `schema_version` and release.
