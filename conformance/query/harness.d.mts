export const GEOMETRY_SHARD_RE: RegExp
export const VIEW_NAME_RE: RegExp
export const VALID_VIEW_NAME_RE: RegExp
export const ALIAS_RE: RegExp
export const LOCAL_DIR_TOKEN: string

export type GoldenResult = { columns: string[]; rows: unknown[][] }
export type ConformanceCase = {
  name: string
  sql: string
  expected: GoldenResult
  /** Engine capabilities the case needs; an engine without them skips it (see README). */
  requires?: string[]
}
export type SuiteSchema = {
  alias: string
  files: string[]
  views: Record<string, string[]>
  notMounted: string[]
  objectPropertiesRowCount: number
  eavRowGroups: number
}
export type LoadedSuite = {
  dir: string
  schema: SuiteSchema
  cases: ConformanceCase[]
  bundleDir: string
  files: Array<{ name: string; path: string }>
  localDir: string
}

export function viewNameOf(fileName: string): string | null
export function mountPlan(fileNames: string[]): {
  views: Array<{ view: string; name: string }>
  skipped: string[]
}
export function objectPropertiesViewSql(alias: string): string
export function loadSuite(dir: string): LoadedSuite
export function expandSql(sql: string, ctx: { localDir: string }): string
export function normalizeCell(actual: unknown, expected: unknown): unknown
export function compareResult(actual: GoldenResult, golden: GoldenResult): string | null
export function rowsFromObjects(columns: string[], rowObjects: Array<Record<string, unknown>>): unknown[][]
