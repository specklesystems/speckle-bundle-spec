// Every hand-written manifest that carries the release version (VERSIONING.md § Bump
// checklist, step 2). The npm manifests are parsed; pyproject, csproj and CMake are
// matched textually on the one line their tooling reads the version from.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPO } from './duck.mjs'

const read = (rel) => readFileSync(join(REPO, rel), 'utf8')
const first = (rel, re) => {
  const m = read(rel).match(re)
  if (!m) throw new Error(`${rel}: no version found (${re})`)
  return m[1]
}

/** @returns {{ file: string, version: string }[]} one row per version-carrying location */
export function manifestVersions() {
  const ts = JSON.parse(read('packages/ts/package.json'))
  const conformance = JSON.parse(read('packages/conformance/package.json'))
  return [
    { file: 'packages/ts/package.json', version: ts.version },
    { file: 'packages/conformance/package.json', version: conformance.version },
    {
      file: 'packages/conformance/package.json dependencies["@speckle/bundle-spec"]',
      version: conformance.dependencies?.['@speckle/bundle-spec']
    },
    {
      file: 'packages/python/pyproject.toml',
      version: first('packages/python/pyproject.toml', /^version\s*=\s*"([^"]+)"/m)
    },
    {
      file: 'packages/csharp/Speckle.Bundle.Spec.csproj',
      version: first('packages/csharp/Speckle.Bundle.Spec.csproj', /<Version>([^<]+)<\/Version>/)
    },
    {
      file: 'packages/cpp/CMakeLists.txt',
      version: first('packages/cpp/CMakeLists.txt', /project\(\s*bundlespec\s+VERSION\s+([^\s)]+)/)
    }
  ]
}
