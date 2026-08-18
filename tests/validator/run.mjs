// Validator regression tests — build tiny fixture bundles (the spec's own tables +
// fixture rows, COPY'd to parquet by DuckDB) and assert validate-bundle.mjs verdicts.
// Guards the empty-nodes incident shape: relations referencing node endpoints while
// the nodes table is EMPTY (or an endpoint dangles) must be a hard validation error.
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync, rmSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { REPO, SPEC } from '../../codegen/lib/duck.mjs'

const DUCKDB = process.env.DUCKDB_BIN || 'duckdb'
const VALIDATOR = join(REPO, 'validator', 'validate-bundle.mjs')

let fails = 0
const check = (cond, msg) => {
  if (!cond) {
    console.error(`  ✗ ${msg}`)
    fails++
  } else console.log(`  ✓ ${msg}`)
}

// Write a fixture bundle: run the spec (tables + catalogs), apply fixture INSERTs,
// COPY every shipped table to `<dir>/fx.*.parquet`. The catalogs ship as-is.
const FILES = {
  objects: 'fx.eav.objects.parquet',
  paths: 'fx.eav.paths.parquet',
  eav: 'fx.eav.eav.parquet',
  nodes: 'fx.envelope.nodes.parquet',
  relations: 'fx.envelope.relations.parquet',
  rel_types: 'fx.envelope.rel_types.parquet',
  node_kinds: 'fx.envelope.node_kinds.parquet',
  meta: 'fx.envelope.meta.parquet',
  geometries: 'fx.geometries.parquet'
}
function writeBundle(dir, fixtureSql) {
  mkdirSync(dir, { recursive: true })
  const copies = Object.entries(FILES)
    .map(([t, f]) => `COPY ${t} TO '${join(dir, f)}' (FORMAT PARQUET);`)
    .join('\n')
  execFileSync(DUCKDB, [], { input: readFileSync(SPEC, 'utf8') + '\n' + fixtureSql + '\n' + copies })
}
const validate = (dir) =>
  spawnSync(process.execPath, [VALIDATOR, dir], { encoding: 'utf8' })

const tmp = mkdtempSync(join(tmpdir(), 'bundle-spec-validator-'))

// 1. healthy bundle: one object placed via DISPLAY_INSTANCE → INSTANCE node 0.
const good = join(tmp, 'good')
writeBundle(
  good,
  `INSERT INTO objects VALUES (0, 'a');
   INSERT INTO nodes VALUES (0, 2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
   INSERT INTO relations VALUES (8, 0, 0, 0);`
)
const g = validate(good)
check(g.status === 0, `healthy bundle validates (exit=${g.status})`)

// 2. THE incident shape: relations reference node endpoints, nodes table is EMPTY.
const empty = join(tmp, 'empty-nodes')
writeBundle(
  empty,
  `INSERT INTO objects VALUES (0, 'a');
   INSERT INTO relations VALUES (8, 0, 0, 0);`
)
const e = validate(empty)
check(e.status !== 0, `EMPTY nodes + node-referencing relations is a hard error (exit=${e.status})`)
check(
  e.stderr.includes('nodes non-empty while relations reference node endpoints'),
  'failure names the empty-nodes-with-node-refs rule'
)

// 3. a single dangling node endpoint (nodes present but the referenced id is not).
const dangling = join(tmp, 'dangling')
writeBundle(
  dangling,
  `INSERT INTO objects VALUES (0, 'a');
   INSERT INTO nodes VALUES (0, 2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
   INSERT INTO relations VALUES (8, 0, 7, 0);`
)
const d = validate(dangling)
check(d.status !== 0, `dangling node endpoint is a hard error (exit=${d.status})`)
check(
  d.stderr.includes('DISPLAY_INSTANCE(8).dst → node endpoints resolve to nodes.id'),
  'failure names the dangling rel endpoint'
)

// 4. healthy member shape (PLACES/DEFINES_MEMBER vocabulary): definition node 0 with a
// geometry member (object 1, DEFINES + DEFINES_MEMBER sharing ord 0), placed by object 0.
const goodMember = join(tmp, 'good-member')
writeBundle(
  goodMember,
  `INSERT INTO objects VALUES (0, 'a'), (1, 'm');
   INSERT INTO nodes VALUES
     (0, 1, 'Def', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
     (1, 2, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
   INSERT INTO relations VALUES (8, 0, 1, 0), (25, 0, 1, 0), (4, 0, 0, 0);`
)
const gm = validate(goodMember)
check(gm.status === 0, `healthy member bundle validates (exit=${gm.status})`)

// 5. a member object that ALSO carries a top-level render edge would bake twice
// (once untransformed at the origin — the ENG-8782 shape).
const memberRenders = join(tmp, 'member-renders')
writeBundle(
  memberRenders,
  `INSERT INTO objects VALUES (0, 'a'), (1, 'm');
   INSERT INTO nodes VALUES
     (0, 1, 'Def', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
     (1, 2, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
   INSERT INTO relations VALUES (8, 0, 1, 0), (25, 0, 1, 0), (4, 0, 0, 0), (1, 1, 0, 0);`
)
const mr = validate(memberRenders)
check(mr.status !== 0, `member with a top-level render edge is a hard error (exit=${mr.status})`)
check(
  mr.stderr.includes('members carry no top-level render edge'),
  'failure names the member render-edge rule'
)

// 6. a DEFINES_MEMBER row with neither DEFINES rows on (definition, ord) nor a PLACES
// placement is a member no consumer can reach.
const memberUnreachable = join(tmp, 'member-unreachable')
writeBundle(
  memberUnreachable,
  `INSERT INTO objects VALUES (0, 'a'), (1, 'm');
   INSERT INTO nodes VALUES (0, 1, 'Def', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
   INSERT INTO relations VALUES (25, 0, 1, 0);`
)
const mu = validate(memberUnreachable)
check(mu.status !== 0, `unreachable DEFINES_MEMBER member is a hard error (exit=${mu.status})`)
check(mu.stderr.includes('members resolve'), 'failure names the member-resolution rule')

// 7. PLACES must target an INSTANCE node — association to any other kind is a
// producer bug (the dst carries no transform to place).
const placesWrongKind = join(tmp, 'places-wrong-kind')
writeBundle(
  placesWrongKind,
  `INSERT INTO objects VALUES (0, 'a');
   INSERT INTO nodes VALUES (0, 7, 'Layer', NULL, NULL, NULL, 'Collection', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
   INSERT INTO relations VALUES (24, 0, 0, 0);`
)
const pw = validate(placesWrongKind)
check(pw.status !== 0, `PLACES to a non-INSTANCE node is a hard error (exit=${pw.status})`)
check(pw.stderr.includes('every target is an INSTANCE node'), 'failure names the PLACES kind rule')

rmSync(tmp, { recursive: true, force: true })
console.log(fails === 0 ? '\nvalidator tests: PASS' : `\nvalidator tests: ${fails} FAILURE(S)`)
process.exit(fails === 0 ? 0 : 1)
