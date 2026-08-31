// Engine-agnostic half of the query conformance suite: loading, the mount plan an engine
// must reproduce, and result comparison. Pure JS (no DuckDB, no fs beyond loading the
// suite) so the server Query Engine and the browser attach path run it verbatim from the
// vendored copy; the .NET / Python engines reimplement these ~80 lines in-language.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Every geometry shard: `{base}.geometries.parquet` + `{base}.geometries.{N}.parquet`. */
export const GEOMETRY_SHARD_RE = /\.geometries(?:\.\d+)?\.parquet$/
/** `{base}.eav.objects.parquet` → `objects`; `{base}.envelope.nodes.parquet` → `nodes`. */
export const VIEW_NAME_RE = /\.(?:eav|envelope)\.(.+)\.parquet$/
/** A derived view name an engine may interpolate into DDL; anything else is skipped. */
export const VALID_VIEW_NAME_RE = /^[a-zA-Z0-9_]+$/
/** The alias rule shared by every engine (schema name per mounted ref). */
export const ALIAS_RE = /^[a-zA-Z0-9_]{3,}$/
/** Placeholder in a case's SQL for the absolute directory holding `local/`. */
export const LOCAL_DIR_TOKEN = '{{local_dir}}'
/**
 * The mount-internal name the paths parquet is registered under: the public `paths`
 * name belongs to the synthesized view (see `pathsViewSql`).
 */
export const PATHS_RAW_VIEW = 'paths_raw'
/**
 * The virtual `applicationId` property path. Producers carry applicationId in the
 * `objects` table and most never duplicate it into the eav, so every mount synthesizes
 * it: a sentinel row in `paths` plus a matching arm in `object_properties`, both guarded
 * on the producer not already emitting the path. The ordinal is negative so it can never
 * collide with a real dictionary entry, and consumers that must exclude the virtual path
 * (grouping dimensions — a unique-per-object dimension is meaningless) filter
 * `path_index >= 0`.
 */
export const APPLICATION_ID_PATH = 'applicationId'
export const APPLICATION_ID_PATH_INDEX = -1

/** The view a bundle file mounts as, or null when the file is never mounted. */
export function viewNameOf(fileName) {
  if (GEOMETRY_SHARD_RE.test(fileName)) return null
  const m = fileName.match(VIEW_NAME_RE)
  if (!m) return null
  return VALID_VIEW_NAME_RE.test(m[1]) ? m[1] : null
}

/**
 * The mount plan for a file list: which files become which views (first name wins on a
 * duplicate view) and which files are skipped. Engines that build their own plan must
 * agree with this one — schema.json is asserted against it.
 *
 * Deduplication is on the *derived* name; the paths parquet is then renamed to
 * `paths_raw`, leaving the public `paths` name free for the synthesized view.
 */
export function mountPlan(fileNames) {
  const views = []
  const skipped = []
  const seen = new Set()
  for (const name of fileNames) {
    const view = viewNameOf(name)
    if (!view || seen.has(view)) {
      skipped.push(name)
      continue
    }
    seen.add(view)
    views.push({ view: view === 'paths' ? PATHS_RAW_VIEW : view, name })
  }
  return { views, skipped }
}

/** Guard for the synthesized `paths` view: active only when the producer did not already
 * emit applicationId as a real eav path. Reads the raw dictionary — the public `paths`
 * view would be a self-reference here. */
const virtualPathGuard = (s) =>
  `NOT EXISTS (SELECT 1 FROM "${s}"."${PATHS_RAW_VIEW}" ` + `WHERE path = '${APPLICATION_ID_PATH}')`

/** The same guard for `object_properties`, phrased against the public `paths` view (real
 * dictionary rows only — the virtual row is negative). */
const virtualArmGuard = (s) =>
  `NOT EXISTS (SELECT 1 FROM "${s}"."paths" ` +
  `WHERE path = '${APPLICATION_ID_PATH}' AND path_index >= 0)`

/** The public `paths` view DDL: the raw dictionary ∪ the virtual applicationId row. */
export function pathsViewSql(alias) {
  const s = alias
  return (
    `CREATE OR REPLACE VIEW "${s}"."paths" AS ` +
    `SELECT path_index, path FROM "${s}"."${PATHS_RAW_VIEW}" ` +
    `UNION ALL ` +
    `SELECT ${APPLICATION_ID_PATH_INDEX} AS path_index, ` +
    `'${APPLICATION_ID_PATH}' AS path ` +
    `WHERE ${virtualPathGuard(s)}`
  )
}

/**
 * The canonical `object_properties` union view DDL for an alias schema: instance `eav`
 * rows ∪ type params resolved through `object_type` ∪ the guarded virtual applicationId
 * arm read from `objects`.
 */
export function objectPropertiesViewSql(alias) {
  const s = alias
  const cols =
    'object_index, path_index, value_string, value_double, value_boolean, unit, internal_definition_name'
  return (
    `CREATE OR REPLACE VIEW "${s}"."object_properties" AS ` +
    `SELECT ${cols} FROM "${s}"."eav" ` +
    `UNION ALL ` +
    `SELECT ot.object_index, te.path_index, te.value_string, te.value_double, ` +
    `te.value_boolean, te.unit, te.internal_definition_name ` +
    `FROM "${s}"."object_type" ot JOIN "${s}"."type_eav" te ON te.type_index = ot.type_index ` +
    `UNION ALL ` +
    `SELECT o.object_index, ${APPLICATION_ID_PATH_INDEX}, o.application_id, ` +
    `NULL, NULL, NULL, NULL ` +
    `FROM "${s}"."objects" o WHERE ${virtualArmGuard(s)}`
  )
}

/** The synthesized-view statements every mount runs after the per-file views. Order
 * matters: `paths` must exist before `object_properties` (whose guard reads it). */
export function bundleMountExtraSql(alias) {
  return [pathsViewSql(alias), objectPropertiesViewSql(alias)]
}

/** Load the suite rooted at `dir` (the directory holding cases.json). */
export function loadSuite(dir) {
  const schema = JSON.parse(readFileSync(join(dir, 'schema.json'), 'utf8'))
  const { cases } = JSON.parse(readFileSync(join(dir, 'cases.json'), 'utf8'))
  const bundleDir = join(dir, 'bundle')
  const files = readdirSync(bundleDir)
    .sort()
    .map((name) => ({ name, path: join(bundleDir, name) }))
  return { dir, schema, cases, bundleDir, files, localDir: join(dir, 'local') }
}

/** Substitute the suite's placeholders into a case's SQL. */
export function expandSql(sql, { localDir }) {
  return sql.split(LOCAL_DIR_TOKEN).join(localDir)
}

/**
 * Bring one cell to the comparison domain. Engines disagree on transport (DuckDB-WASM and
 * `getRowObjectsJson` hand BIGINT/DECIMAL back as strings, the CLI as numbers, bindings as
 * BigInt), so numbers-as-text are numbers when the expected cell is numeric, booleans may
 * arrive as 'true'/'false', and nested values compare as JSON.
 */
export function normalizeCell(actual, expected) {
  if (actual === undefined) return null
  if (actual === null) return null
  if (typeof actual === 'bigint') return Number(actual)
  if (typeof expected === 'number' && typeof actual === 'string' && /^-?\d+(\.\d+)?$/.test(actual))
    return Number(actual)
  if (typeof expected === 'boolean' && (actual === 'true' || actual === 'false'))
    return actual === 'true'
  if (typeof actual === 'object') return JSON.stringify(actual)
  return actual
}

const cellsEqual = (actual, expected) => {
  const a = normalizeCell(actual, expected)
  if (typeof expected === 'number' && typeof a === 'number')
    return Math.abs(a - expected) <= 1e-6 * Math.max(1, Math.abs(expected))
  return a === expected
}

/**
 * Compare an engine result `{ columns: string[], rows: unknown[][] }` against a case's
 * golden `{ columns, rows }`. Returns null when they match, else a one-line reason.
 */
export function compareResult(actual, golden) {
  const cols = golden.columns
  if (actual.columns.length !== cols.length || actual.columns.some((c, i) => c !== cols[i]))
    return `columns ${JSON.stringify(actual.columns)} ≠ ${JSON.stringify(cols)}`
  if (actual.rows.length !== golden.rows.length)
    return `row count ${actual.rows.length} ≠ ${golden.rows.length}`
  for (let r = 0; r < golden.rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      if (!cellsEqual(actual.rows[r][c], golden.rows[r][c]))
        return (
          `row ${r} column ${cols[c]}: ` +
          `${JSON.stringify(normalizeCell(actual.rows[r][c], golden.rows[r][c]))} ≠ ` +
          `${JSON.stringify(golden.rows[r][c])}`
        )
    }
  }
  return null
}

/** Row objects (`{col: value}`) → positional rows in `columns` order. */
export function rowsFromObjects(columns, rowObjects) {
  return rowObjects.map((row) => columns.map((c) => row[c]))
}
