# Bundle spec versioning

How `schema_version` is bumped, where the number lives, and how a tag becomes a release.

## One number everywhere

`schema_version` **is** the package version — the semver string producers stamp into
`{base}.envelope.meta.parquet`, the git tag, and the version of all five published
artifacts:

| Artifact | Registry |
|---|---|
| `@speckle/bundle-spec` (catalog + the SQL) | npmjs and the private Verdaccio registry |
| `@speckle/bundle-spec-conformance` (validator bin + query-conformance suite) | npmjs and Verdaccio |
| `speckle-bundle-spec` | PyPI |
| `Speckle.Bundle.Spec` | nuget.org |
| `speckle-bundle-spec-cpp-X.Y.Z.tar.gz` | GitHub Release asset |

One number answers both "what vocabulary was this bundle written against" and "what do I
pin". Consequence, accepted on purpose: a validator, harness or docs fix is a **patch
release**, and bundles written afterwards carry that patch number with no schema change.
There is no second versioning scheme for the tooling.

The number lives in exactly one tracked file: the `meta` row of `spec/bundle-spec.sql`.
No manifest carries it — `packages/*/package.json` say `0.0.0`, the csproj has no
`<Version>`, `pyproject.toml` is `dynamic` (hatch-vcs), `CMakeLists.txt` reads a `VERSION`
file that only the release tarball contains. `scripts/build-artifacts.sh <version>` stamps
every artifact at build time: the tag on a release, `0.0.0` on a PR build, and the release
gate refuses a tag that is not the `meta` row's value.

Consumers never gate on the value (the validator only checks columns are present); the
number is provenance — the only thing that tells a reader which catalog a bundle was
written against.

## When to bump which part

**Major** — the meaning of an existing bundle changes, i.e. a consumer reading an old
bundle with the new vocabulary would be wrong:

- a rel / node-kind id changes meaning, or a retired id is un-retired
- a column is removed or its type/semantics change
- a file in `bundle_files` is renamed, or its optional/required status flips
- precedence rules change (e.g. material/colour ladders)

**Minor** — additive schema changes: new rel/kind ids, new optional columns, new optional
files. Writers pin exactly, so an additive minor still needs an adoption PR per writer
(the generated column indices shift).

**Patch** — tooling, docs, comment/rationale edits. Retire ids in place
(`status='retired'`), never reuse.

Between releases, log changes under `## unreleased (schema_version <next>, additive)` in
`CHANGELOG.md`, where `<next>` is the version they will ship as.

## Bump checklist

1. `spec/bundle-spec.sql` — `INSERT INTO meta VALUES ('<x.y.z>', …)` (the source) and the
   header comment `(schema_version <x.y.z>)` on line 2.
2. `npm run generate` — regenerates every package's code (the stamp lands as
   `SCHEMA_VERSION` / `SchemaVersion` / `kSchemaVersion`) and `docs/reference.md`.
3. `CHANGELOG.md` — rename `## unreleased (schema_version <x.y.z>, additive)` to
   `## schema_version <x.y.z> — <title>`. The release gate refuses a tag while an
   `## unreleased (schema_version <x.y.z>…)` heading exists or the released section is
   missing.
4. `README.md` — the install table (`@…@<x.y.z>`, `==<x.y.z>`, `[<x.y.z>]`, the Release
   tarball URL) and the "current vocabulary (schema_version <x.y.z>)" line at the bottom —
   and the `GLOSSARY.md` `schema_version` entry. Prose only; nothing guards it — grep for
   the old string.
5. `npm test && npm run check` — the release-gate test (the repo passes its own gate at
   `<x.y.z>`) and no generated-code drift. `scripts/build-artifacts.sh <x.y.z> &&
   scripts/smoke-artifacts.sh <x.y.z>` is what CI runs if you want it locally (needs uv,
   dotnet, cmake + a C++ compiler).
6. One commit (e.g. `chore: release <x.y.z>`), PR, merge.

## Release: the tag is the release

```bash
git tag <x.y.z> <merge-commit> && git push origin <x.y.z>
```

Tag with git, never through GitHub's "Draft a new release": the UI suggests the next
patch after the last tag, and the repo has immutable releases — a release created by hand
is published before the workflow reaches it, its assets are locked, and that tag can never
carry the C++ tarball (`1.4.0` lost it this way). The workflow creates the release.

`.github/workflows/release.yml` runs, in order:

1. **Gate** — `scripts/release-gate.mjs`: the tag equals `meta.schema_version`;
   `CHANGELOG.md` has `## schema_version <x.y.z>` and no
   `## unreleased (schema_version <x.y.z>…)`.
2. **Verify** — the PR workflow (`ci.yml`) called with the tag: regenerate-and-diff, the
   test suite, the build of all five artifacts stamped with the tag and the consumer smoke
   of each (`scripts/smoke-artifacts.sh`), which checks both the package version and the
   generated `SCHEMA_VERSION` constants.
3. **Publish**, one job per target, all from the artifacts the verify job built: npmjs
   (OIDC trusted publishing, provenance) and Verdaccio over Tailscale (`speckledevbot`'s
   `NPM_TOKEN`); PyPI (OIDC); nuget.org (OIDC via `NuGet/login`, `NUGET_USER`); a GitHub
   Release whose notes are the changelog section, created with the C++ tarball and its
   `.sha256` in one step (draft → upload → publish, as immutable releases require).

Every gate runs before the first publish. If one registry fails after others succeeded,
**re-run the failed job(s)** of that same workflow run (Actions → the run → "Re-run failed
jobs"); never delete or move the tag, and never re-tag the same version. Registries do
not accept a second upload of a version, so a successful job re-run is a no-op where the
registry allows it (nuget `--skip-duplicate`, a GitHub Release that already carries the
tarball) and a refused duplicate elsewhere — both mean "already there". The one
unrecoverable case: a GitHub Release published without the tarball (someone created it
by hand) — the job fails on purpose, and the C++ target starts at the next patch.

Tags before `1.4.0` were never published as packages and will not be backfilled.

## Downstream — the declaration is the pin

Every first-party consumer pins the **exact** version in its ordinary dependency
declaration; there is nothing else to keep in step. A spec release is not done until each
of these has a merged, human-reviewed bump PR (atlas ADR-0004: the schema change ships
together with its writer adoptions).

| Repo | Declaration |
|---|---|
| `speckle-server-internal` | `@speckle/bundle-spec` (dependency), `@speckle/bundle-spec-conformance` (devDependency) |
| `speckle-sharp-sdk` | `<PackageReference Include="Speckle.Bundle.Spec" Version="[x.y.z]" />` in `Speckle.Sdk.Parquet` |
| `specklepy` | `speckle-bundle-spec==x.y.z` in `pyproject.toml` (`specklepy.bundle.spec` re-exports it) |
| `speckle-converters` | CMake `FetchContent_Declare(bundlespec URL …/speckle-bundle-spec-cpp-x.y.z.tar.gz URL_HASH SHA256=…)` plus its expected-version assertion against `bundlespec_VERSION`; golden validation calls the conformance package's `validate-bundle` bin |

`speckle-sketchup` keeps a hand-transcribed Ruby vocabulary (`SCHEMA_VERSION = '<x.y.z>'`
in `envelope_writer.rb`) with no drift guard — grep and edit it by hand.

## Not this number

`Version.schemaVersion` on the server GraphQL API (`ENVELOPE_BUNDLE_SCHEMA_VERSION = 3`
in `speckle-server/.../modules/data/domain/types.ts`, `QUERYABLE_SCHEMA_VERSION = 3` in
frontend-3, `schemaVersion === 3` in the WebGPU viewer) is the **server-side
storage-format flag** ("this version has a parquet bundle"), not the bundle catalog
version. It does not move when `schema_version` moves. Don't touch it during a spec bump.

## Verify after a bump

- The GitHub Release for the tag exists with the tarball and `.sha256`; each registry
  lists the version.
- Send a model from each producer and read `{base}.envelope.meta.parquet`:
  ```sql
  SELECT schema_version, produced_by, sdk_name FROM 'x.envelope.meta.parquet';
  ```
  All producers must report the same `schema_version`.
- `npx validate-bundle <bundle-dir>` (from `@speckle/bundle-spec-conformance`) passes on a
  fresh bundle from each producer.
