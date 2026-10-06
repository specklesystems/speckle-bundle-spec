#!/usr/bin/env node
// Release gate (VERSIONING.md § Release): refuse a tag whose version disagrees with any
// manifest, the SQL meta row or the changelog, before anything is published.
//   node scripts/release-gate.mjs <tag> [--notes <file>]
// <tag> may be `refs/tags/X.Y.Z` or `X.Y.Z`; --notes writes the tag's changelog section
// (the GitHub Release body) so one place owns the heading rule.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, schemaVersion } from '../codegen/lib/duck.mjs'
import { manifestVersions } from '../codegen/lib/versions.mjs'

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const releasedHeading = (tag) => new RegExp(`^## schema_version ${escape(tag)}(\\s|$)`)
const unreleasedHeading = (tag) => new RegExp(`^## unreleased \\(schema_version ${escape(tag)}[,)\\s]`)

/** The changelog section released as `tag` (heading included), or null when there is none. */
export function changelogSection(changelog, tag) {
  const lines = changelog.split('\n')
  const start = lines.findIndex((l) => releasedHeading(tag).test(l))
  if (start < 0) return null
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '))
  if (end < 0) end = lines.length
  return lines.slice(start, end).join('\n').trimEnd() + '\n'
}

/** The problems a tag has against the versions and changelog it would release; [] = releasable. */
export function releaseProblems({ tag, schemaVersion, manifests, changelog }) {
  const problems = []
  if (schemaVersion !== tag) problems.push(`meta.schema_version is ${schemaVersion}, tag is ${tag}`)
  for (const { file, version } of manifests)
    if (version !== tag) problems.push(`${file} is ${JSON.stringify(version)}, tag is ${tag}`)
  if (changelogSection(changelog, tag) === null)
    problems.push(`CHANGELOG.md has no "## schema_version ${tag}" section`)
  if (changelog.split('\n').some((l) => unreleasedHeading(tag).test(l)))
    problems.push(`CHANGELOG.md still has an "## unreleased (schema_version ${tag}…)" heading`)
  return problems
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const notesAt = args.indexOf('--notes')
  const notes = notesAt >= 0 ? args.splice(notesAt, 2)[1] : null
  const tag = (args[0] ?? '').replace(/^refs\/tags\//, '')
  if (!tag) {
    console.error('usage: release-gate.mjs <tag> [--notes <file>]')
    process.exit(2)
  }
  const changelog = readFileSync(join(REPO, 'CHANGELOG.md'), 'utf8')
  const problems = releaseProblems({ tag, schemaVersion: schemaVersion(), manifests: manifestVersions(), changelog })
  for (const p of problems) console.error(`  ✗ ${p}`)
  if (problems.length === 0 && notes) writeFileSync(notes, changelogSection(changelog, tag))
  console.log(problems.length === 0 ? `release gate: ${tag} PASS` : `release gate: ${tag} ${problems.length} PROBLEM(S)`)
  process.exit(problems.length === 0 ? 0 : 1)
}
