#!/usr/bin/env bash
# Build the five release artifacts into out/, stamped with <version> — the git tag on a
# release, 0.0.0 on a dry build (VERSIONING.md). Nothing in git carries the version; it is
# applied here, in staging copies, so the working tree stays clean.
#   scripts/build-artifacts.sh <version>
#   out/npm/*.tgz                                 @speckle/bundle-spec, @speckle/bundle-spec-conformance
#   out/python/*.whl, *.tar.gz                    speckle-bundle-spec
#   out/nuget/*.nupkg, *.snupkg                   Speckle.Bundle.Spec
#   out/cpp/speckle-bundle-spec-cpp-<version>.tar.gz  header tarball (+ .sha256)
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=${1:?usage: build-artifacts.sh <version>}
rm -rf out
mkdir -p out/npm out/python out/nuget out/cpp out/stage

echo "== npm ($VERSION)"
# Staging copies sit inside the repo so `prepack` (tsc) resolves the root node_modules.
cp -r packages/ts out/stage/ts
cp -r packages/conformance out/stage/conformance
(cd out/stage/ts && npm pkg set "version=$VERSION" && npm pack --pack-destination ../../npm)
(cd out/stage/conformance && npm pkg set "version=$VERSION" "dependencies.@speckle/bundle-spec=$VERSION" && npm pack --pack-destination ../../npm)

echo "== python ($VERSION)"
SETUPTOOLS_SCM_PRETEND_VERSION="$VERSION" uv build packages/python --out-dir out/python

echo "== nuget ($VERSION)"
dotnet pack packages/csharp --configuration Release --output out/nuget -p:Version="$VERSION"

echo "== cpp ($VERSION)"
cp -r packages/cpp out/stage/cpp
printf '%s\n' "$VERSION" > out/stage/cpp/VERSION
# Deterministic archive: sorted entries, fixed mtime/owner, no gzip timestamp — so a
# re-run produces the same bytes and the same sha256 as the first build.
tarball="out/cpp/speckle-bundle-spec-cpp-${VERSION}.tar.gz"
tar --sort=name --mtime='1970-01-01 00:00:00Z' --owner=0 --group=0 --numeric-owner \
  -C out/stage/cpp -cf - CMakeLists.txt VERSION include | gzip -n > "$tarball"
(cd out/cpp && sha256sum "$(basename "$tarball")" > "$(basename "$tarball").sha256")

rm -rf out/stage
echo
find out -type f | sort
