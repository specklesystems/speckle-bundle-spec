// Run queries against the spec: execute bundle-spec.sql in an in-memory DuckDB, then
// the given SELECT, and return the rows as JS objects. No SQL parser — we let DuckDB
// (already in the stack) be the spec interpreter.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const DUCKDB = process.env.DUCKDB_BIN || 'duckdb'

// schema_version is a semver STRING (== every package version). Guard the shape so a
// stray integer in the spec row can never regenerate silently into every target.
export const SEMVER_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/

/** Bind the query helpers to one executable spec file. */
export function createSpec(sqlPath) {
  let specSql = null
  const spec = () => (specSql ??= readFileSync(sqlPath, 'utf8'))

  /** Execute arbitrary SQL with the spec already loaded; return parsed rows. */
  function query(sql, { withSpec = true } = {}) {
    const input = (withSpec ? spec() + '\n' : '') + sql + '\n'
    const out = execFileSync(DUCKDB, ['-json'], {
      input,
      encoding: 'utf8',
      maxBuffer: 1 << 28
    })
    const t = out.trim()
    // DuckDB ≥1.5 -json prints the malformed literal `[{]` for an empty result set.
    if (!t || t === '[{]') return []
    // DuckDB's -json mode encodes BOOLEAN as the strings "true"/"false" — and
    // "false" is truthy in JS. Coerce those exact tokens back to real booleans so
    // callers can branch on them. (No catalog text value is exactly true/false.)
    return JSON.parse(t).map((row) => {
      for (const k in row) {
        if (row[k] === 'true') row[k] = true
        else if (row[k] === 'false') row[k] = false
      }
      return row
    })
  }

  const relTypes = () =>
    query(
      `SELECT rel AS id, name, src_ns, dst_ns, status, emitted_by, ord_semantics, description, why
       FROM rel_types ORDER BY rel`
    )

  const nodeKinds = () =>
    query(
      `SELECT kind AS id, name, status, columns, subtype_values, description, why
       FROM node_kinds ORDER BY kind`
    )

  const bundleFiles = () =>
    query(
      `SELECT ord, name, file_pattern, file_glob, sharded, required, self_describing, description
       FROM bundle_files ORDER BY ord`
    )

  /** Logical tables with their columns + comments, from information_schema/duckdb_columns. */
  const tableColumns = () =>
    query(
      `SELECT table_name, column_name, data_type, is_nullable, comment
       FROM duckdb_columns()
       WHERE database_name = 'memory' AND schema_name = 'main'
         AND table_name NOT IN ('rel_types','node_kinds','bundle_files','meta')
       ORDER BY table_name, column_index`
    )

  const schemaVersion = () => {
    const v = query(`SELECT schema_version AS v FROM meta`)[0].v
    if (typeof v !== 'string' || !SEMVER_RE.test(v))
      throw new Error(`meta.schema_version must be a semver string, got ${JSON.stringify(v)}`)
    return v
  }

  return { query, relTypes, nodeKinds, bundleFiles, tableColumns, schemaVersion }
}

/** The spec as shipped in the `@speckle/bundle-spec` version this package depends on. */
export function packagedSpec() {
  const require = createRequire(import.meta.url)
  return createSpec(require.resolve('@speckle/bundle-spec/spec/bundle-spec.sql'))
}
