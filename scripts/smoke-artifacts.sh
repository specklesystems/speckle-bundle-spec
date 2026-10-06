#!/usr/bin/env bash
# Consumer smoke of the artifacts in out/ (spec § Testing Decisions, artifact seam): each
# ecosystem's artifact is consumed from a scratch project outside the repo. Every package
# must report <version> (what build-artifacts.sh stamped) and every generated constant must
# report the SQL meta.schema_version; the release gate makes the two equal on a tag.
# Needs node, uv, dotnet, cmake + a C++17 compiler and the duckdb CLI.
#   scripts/smoke-artifacts.sh <version>
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=$(pwd)
VERSION=${1:?usage: smoke-artifacts.sh <version>}
SCHEMA=$(node -e "import('./codegen/lib/duck.mjs').then((m) => console.log(m.schemaVersion()))")
SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT

expect() { # expect <surface> <expected> <actual>
  if [ "$3" != "$2" ]; then
    echo "✗ $1 reports '$3', expected $2" >&2
    exit 1
  fi
  echo "✓ $1 reports $2"
}

echo "== npm: install the packed tarballs into a scratch project"
mkdir "$SCRATCH/npm" && cd "$SCRATCH/npm"
npm init -y >/dev/null
npm install --no-audit --no-fund "$REPO"/out/npm/speckle-bundle-spec-*.tgz "$REPO"/out/npm/speckle-bundle-spec-conformance-*.tgz >/dev/null
expect "@speckle/bundle-spec package version" "$VERSION" "$(node -p "require('@speckle/bundle-spec/package.json').version")"
expect "@speckle/bundle-spec SCHEMA_VERSION" "$SCHEMA" "$(node --input-type=module -e "import { SCHEMA_VERSION } from '@speckle/bundle-spec'; console.log(SCHEMA_VERSION)")"
expect "@speckle/bundle-spec/spec/bundle-spec.sql meta row" "$SCHEMA" "$(node --input-type=module -e "
  import { createRequire } from 'node:module'
  const sql = createRequire(import.meta.url).resolve('@speckle/bundle-spec/spec/bundle-spec.sql')
  console.log(/INSERT INTO meta VALUES \('([^']+)'/.exec((await import('node:fs')).readFileSync(sql, 'utf8'))[1])")"
expect "@speckle/bundle-spec-conformance package version" "$VERSION" "$(node -p "require('@speckle/bundle-spec-conformance/package.json').version")"
expect "@speckle/bundle-spec-conformance dependency on the catalog" "$VERSION" "$(node -p "require('@speckle/bundle-spec-conformance/package.json').dependencies['@speckle/bundle-spec']")"
npx validate-bundle "$REPO/packages/conformance/query/bundle" >/dev/null
echo "✓ validate-bundle bin validates the golden bundle"
node --input-type=module -e "
  import { loadSuite } from '@speckle/bundle-spec-conformance'
  import { createRequire } from 'node:module'
  import { dirname } from 'node:path'
  const dir = dirname(createRequire(import.meta.url).resolve('@speckle/bundle-spec-conformance/query/cases.json'))
  const suite = loadSuite(dir)
  if (suite.cases.length === 0 || suite.files.length === 0) throw new Error('empty suite')
  console.log('✓ query-conformance suite loads from the package:', suite.cases.length, 'cases,', suite.files.length, 'files')"
cd "$REPO"

echo "== python: install the wheel"
wheel=$(ls out/python/*.whl)
py() { uv run --no-project --isolated --with "$wheel" python -c "$1"; }
expect "speckle-bundle-spec distribution version" "$VERSION" "$(py 'from importlib.metadata import version; print(version("speckle-bundle-spec"))')"
expect "speckle-bundle-spec SCHEMA_VERSION" "$SCHEMA" "$(py 'import speckle_bundle_spec as s; print(s.SCHEMA_VERSION)')"
# The package root is hand-written; every public name of the generated modules must be reachable from it.
py '
import importlib, speckle_bundle_spec as root
generated = set()
for m in ("bundle_spec", "bundle_schemas", "bundle_cols", "bundle_nodes", "bundle_rows"):
    mod = importlib.import_module(f"speckle_bundle_spec.{m}")
    generated |= {n for n in vars(mod) if not n.startswith("_") and getattr(getattr(mod, n), "__module__", mod.__name__) == mod.__name__}
missing = sorted(generated - set(root.__all__))
if missing: raise SystemExit(f"speckle_bundle_spec.__all__ misses generated names: {missing}")
print(f"✓ __all__ re-exports every generated public name ({len(generated)})")'

echo "== nuget: reference the nupkg from a scratch console app"
mkdir "$SCRATCH/dotnet" && cd "$SCRATCH/dotnet"
cat > nuget.config <<EOF
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
    <add key="local" value="$REPO/out/nuget" />
  </packageSources>
</configuration>
EOF
dotnet new console --name Smoke --output . --force >/dev/null
dotnet add package Speckle.Bundle.Spec --version "[$VERSION]" >/dev/null
cat > Program.cs <<'EOF'
System.Console.WriteLine(typeof(Speckle.Bundle.Spec.BundleSpec).Assembly.GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false) is [System.Reflection.AssemblyInformationalVersionAttribute a] ? a.InformationalVersion.Split('+')[0] : "?");
System.Console.WriteLine(Speckle.Bundle.Spec.BundleSpec.SchemaVersion);
System.Console.WriteLine(Speckle.Bundle.Spec.Catalog.RelTypes.Length > 0 && Speckle.Bundle.Spec.BundleSchemas.ByTable.Count > 0);
EOF
out=$(dotnet run --nologo 2>&1 | tail -3)
expect "Speckle.Bundle.Spec package version (restored at exactly [$VERSION], assembly informational version)" "$VERSION" "$(echo "$out" | sed -n 1p)"
expect "Speckle.Bundle.Spec.BundleSpec.SchemaVersion" "$SCHEMA" "$(echo "$out" | sed -n 2p)"
if [ "$(echo "$out" | sed -n 3p)" != "True" ]; then echo "✗ Catalog/BundleSchemas empty or unresolved: $out" >&2; exit 1; fi
echo "✓ Catalog and BundleSchemas resolve from the package"
cd "$REPO"

echo "== cpp: FetchContent the tarball by URL + sha256 from a scratch CMake project"
tarball=$(ls out/cpp/speckle-bundle-spec-cpp-*.tar.gz)
sha=$(cut -d' ' -f1 "$tarball.sha256")
mkdir "$SCRATCH/cpp" && cd "$SCRATCH/cpp"
cat > CMakeLists.txt <<EOF
cmake_minimum_required(VERSION 3.14)
project(smoke LANGUAGES CXX)
include(FetchContent)
FetchContent_Declare(bundlespec URL "file://$REPO/$tarball" URL_HASH SHA256=$sha)
FetchContent_MakeAvailable(bundlespec)
message(STATUS "bundlespec_VERSION=\${bundlespec_VERSION}")
add_executable(smoke main.cpp)
target_link_libraries(smoke PRIVATE bundlespec::bundlespec)
EOF
cat > main.cpp <<'EOF'
#include "envelope_spec.h"
#include "bundle_cols.h"
#include "bundle_nodes.h"
#include "bundle_rows.h"
#include <cstdio>
int main() { std::puts(bundlespec::kSchemaVersion); return 0; }
EOF
cmake -S . -B build >configure.log 2>&1 || { cat configure.log; exit 1; }
expect "bundlespec_VERSION (CMake project version)" "$VERSION" "$(sed -n 's/.*bundlespec_VERSION=//p' configure.log)"
cmake --build build >build.log 2>&1 || { cat build.log; exit 1; }
expect "bundlespec::kSchemaVersion" "$SCHEMA" "$(./build/smoke)"
cd "$REPO"

echo
echo "smoke: all five artifacts report package version $VERSION, schema_version $SCHEMA"
