# ADR-0004: The bundle spec is distributed as registry packages; the dependency declaration is the pin

- **Status**: pointer — the canonical text lives in the speckle-atlas layer:
  spec ADR-0001 of [2026-10 bundle-spec packaging](../../../atlas/specs/2026-10-bundle-spec-packaging/spec.md),
  [`atlas/specs/2026-10-bundle-spec-packaging/adr/0001`](../../../atlas/specs/2026-10-bundle-spec-packaging/adr/0001-registry-packages-dependency-declaration-is-the-pin.md).
  Numbered 0004 here because this repo's local sequence already held 0001–0003.
- **Date**: 2026-10-05

Summary: one package per language at the one version that is `meta.schema_version` —
`@speckle/bundle-spec` and `@speckle/bundle-spec-conformance` (npmjs and the private
Verdaccio registry), `speckle-bundle-spec` (PyPI), `Speckle.Bundle.Spec` (nuget.org), and
a C++ header tarball on the GitHub Release. The tag is the release and CI enforces it.
Manifests are native, hand-written files in git. The version is the git tag, stamped
into every artifact at build time; the SQL `meta` row is the only tracked copy and the
release gate holds the tag to it. Consumers pin exactly and obtain the spec only through
the package; bumps are human-reviewed pull requests, one per consumer.

## What this binds in this repo

- `packages/{ts,conformance,python,csharp,cpp}/` are the shipped artifacts; codegen emits
  into them. The former `generated/` tree, the publish-and-pin script, the verify-pin
  script and the artifact lockfile are retired.
- `scripts/build-artifacts.sh <version>` stamps the tag into every artifact (`0.0.0` on a
  PR build); `scripts/release-gate.mjs` refuses a tag that is not the SQL `meta` row's
  `schema_version` or that `CHANGELOG.md` has not released.
- `.github/workflows/ci.yml` dry-builds and smoke-tests all five artifacts on every PR;
  `.github/workflows/release.yml` publishes on tag `X.Y.Z` with OIDC trusted publishing
  and re-runs per registry on partial failure.
- A tooling-only fix is a patch release of the same version (`VERSIONING.md`).
