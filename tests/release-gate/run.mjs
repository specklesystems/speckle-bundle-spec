// Release-gate tests: the verdict a maintainer sees when tagging, and the release notes
// the GitHub Release gets. The repo as committed must be releasable at its own
// schema_version; each rule that can refuse a tag must refuse for its own reason.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { REPO, schemaVersion } from '../../codegen/lib/duck.mjs'
import { changelogSection, releaseProblems } from '../../scripts/release-gate.mjs'

let fails = 0
const check = (cond, msg) => {
  if (!cond) {
    console.error(`  ✗ ${msg}`)
    fails++
  } else console.log(`  ✓ ${msg}`)
}

const sv = schemaVersion()
const gate = (...args) =>
  spawnSync(process.execPath, [join(REPO, 'scripts', 'release-gate.mjs'), ...args], { encoding: 'utf8' })

// 1. the repository as committed is releasable at its own schema_version, by tag or ref,
// and the notes it would publish are exactly that version's changelog section.
const tmp = mkdtempSync(join(tmpdir(), 'bundle-spec-release-gate-'))
const own = gate(sv, '--notes', join(tmp, 'notes.md'))
check(own.status === 0, `the repo passes the gate for tag ${sv} (exit=${own.status})${own.stderr}`)
const notes = readFileSync(join(tmp, 'notes.md'), 'utf8')
check(notes.startsWith(`## schema_version ${sv}`), 'release notes start at the tag\u2019s changelog heading')
check(notes.split('\n').filter((l) => l.startsWith('## ')).length === 1, 'release notes stop before the next section')
check(gate(`refs/tags/${sv}`).status === 0, `the gate accepts the ref form refs/tags/${sv}`)
rmSync(tmp, { recursive: true, force: true })

// 2. a tag that is not the SQL meta row's schema_version is refused, naming both.
const other = gate('0.0.1')
check(other.status === 1, `tag 0.0.1 is refused (exit=${other.status})`)
check(other.stderr.includes(`meta.schema_version is ${sv}, tag is 0.0.1`), 'refusal names the SQL meta row and the tag')

// 3. the changelog rules, on fixture changelogs with the tag equal to the meta row.
const agreeing = { tag: sv, schemaVersion: sv }
check(
  releaseProblems({ ...agreeing, changelog: `# Changelog\n\n## schema_version 0.9.0 — old\n` }).some((p) =>
    p.includes(`no "## schema_version ${sv}" section`)
  ),
  'a changelog without a section for the tag is refused'
)
check(
  releaseProblems({
    ...agreeing,
    changelog: `# Changelog\n\n## unreleased (schema_version ${sv}, additive)\n\n## schema_version ${sv} — x\n`
  }).some((p) => p.includes('unreleased')),
  'an unreleased heading still naming the tag is refused'
)
check(
  releaseProblems({ ...agreeing, changelog: `# Changelog\n\n## schema_version ${sv}1 — x\n` }).length === 1,
  'a section for a longer version string does not satisfy the tag'
)
check(
  releaseProblems({
    ...agreeing,
    changelog: `# Changelog\n\n## unreleased (schema_version ${sv}1, additive)\n\n## schema_version ${sv} — x\n`
  }).length === 0,
  'an unreleased heading naming a different version is not the tag\u2019s problem'
)
check(
  changelogSection(`# C\n\n## schema_version ${sv} — x\n\n- a\n- b\n\n## schema_version 0.9.0\n\n- c\n`, sv) ===
    `## schema_version ${sv} — x\n\n- a\n- b\n`,
  'a section is cut at the next heading with trailing blank lines dropped'
)

console.log(fails === 0 ? '\nrelease gate tests: PASS' : `\nrelease gate tests: ${fails} FAILURE(S)`)
process.exit(fails === 0 ? 0 : 1)
