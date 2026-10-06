#!/usr/bin/env bash
# Build the five release artifacts into out/ exactly as the release workflow publishes
# them. PR CI runs it as the dry build; `scripts/smoke-artifacts.sh` then consumes out/.
#   out/npm/*.tgz                                 @speckle/bundle-spec, @speckle/bundle-spec-conformance
#   out/python/*.whl, *.tar.gz                    speckle-bundle-spec
#   out/nuget/*.nupkg, *.snupkg                   Speckle.Bundle.Spec
#   out/cpp/speckle-bundle-spec-cpp-X.Y.Z.tar.gz  header tarball (+ .sha256)
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./packages/ts/package.json').version")
rm -rf out
mkdir -p out/npm out/python out/nuget out/cpp

echo "== npm"
npm run build --workspace packages/ts
npm pack --workspace packages/ts --workspace packages/conformance --pack-destination out/npm

echo "== python"
uv build packages/python --out-dir out/python

echo "== nuget"
dotnet pack packages/csharp --configuration Release --output out/nuget

echo "== cpp"
# Deterministic archive: sorted entries, fixed mtime/owner, no gzip timestamp — so a
# re-run produces the same bytes and the same sha256 as the first build.
tarball="out/cpp/speckle-bundle-spec-cpp-${VERSION}.tar.gz"
tar --sort=name --mtime='1970-01-01 00:00:00Z' --owner=0 --group=0 --numeric-owner \
  -C packages/cpp -cf - CMakeLists.txt include | gzip -n > "$tarball"
(cd out/cpp && sha256sum "$(basename "$tarball")" > "$(basename "$tarball").sha256")

echo
find out -type f | sort
