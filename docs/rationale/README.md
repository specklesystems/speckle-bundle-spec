# Rationale

Long-form design history and the "why" behind the bundle format. The machine
reference (vocabulary, table shapes, per-column notes) is generated into
`../reference.md` from `spec/bundle-spec.sql` — these essays **link to it** rather
than restating it, so prose and schema can't drift.

Suggested notes to port here from the producer repos' SOT docs:

- **eav vs nested objects** — why the model is flat (parse-free, columnar, duckdb-filterable).
- **The two K-spaces** — object K vs node K (and geometry K), and namespace disambiguation.
- **`ord` as scope** — why CONNECTS_TO overloads `ord` (system-K / opening-K) instead of an edge-attribute table.
- **Nodes are bounded structural scaffolding** — why nodes keep a fixed-column schema while objects get eav; the rule that keeps "add a column when needed" safe.
- **MEP topology (M4)** and **spatial topology (M5)** — the justified-graph / space-syntax design.
- **IN_SYSTEM/IN_NETWORK & COLLECTION/CONTAINER collapses** — one polymorphic grouping node, subtype as the discriminator.
