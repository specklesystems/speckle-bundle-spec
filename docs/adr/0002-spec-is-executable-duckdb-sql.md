---
status: accepted
---

# The single source of truth is executable DuckDB SQL

The bundle format is specified in one executable `.sql` file
(`spec/bundle-spec.sql`): `CREATE TABLE` DDL for every table's shape (+ `COMMENT ON`
for per-column semantics), and `CREATE TABLE … INSERT` for the semantic catalogs
(`rel_types`, `node_kinds`, `bundle_files`) where the meaning (`description`, `why`,
`status`, `emitted_by`, `ord_semantics`) rides as columns. The bundle is stored as
parquet and read by DuckDB, so the spec is described in the engine its consumers
already speak. SQL is ancient, ubiquitous, and self-validating in our own stack.

Codegen does **not** parse SQL — it executes the spec in an in-memory DuckDB and
`SELECT`s the catalogs / `information_schema`, then templates per-language outputs.
The same engine validates a real bundle against the spec.

## Considered options

- **Protobuf (or another IDL).** The standard "define once, codegen many languages"
  tool — but its core value is binary (de)serialization codegen, and our bundle is
  self-describing parquet, so our "many languages" need is just enum/constant + schema
  emission (a `SELECT` + a template). Proto's one genuinely useful feature here, native
  `reserved` field numbers, is replicated by a `status='retired'` row plus a
  conformance test. **Revisit only if the bundle becomes a binary wire format that
  needs real serialization codegen.**
- **YAML.** Rejected: it re-encodes, in an invented vocabulary, something the engine
  already describes natively — and the author dislikes it.
- **Avro / JSON-Schema / dbt-style (SQL + YAML descriptions).** Considered, same
  conclusion: none is executable in our engine, and the last drags YAML back in for
  exactly the semantics we want as SQL columns.

## Consequences

- Codegen and the validator require the `duckdb` CLI. Acceptable: it's already the
  consumer engine, and `generated/` is committed, so day-to-day *consumers* need no
  toolchain — only spec editors and validation CI do.
- `duckdb -json` encodes BOOLEAN as the strings `"true"`/`"false"` (both truthy in JS);
  the query helper coerces them centrally.
- Short semantics live in the spec as columns; long-form rationale lives in
  `docs/rationale/` and links back, because paragraph prose is miserable as SQL string
  literals.
