---
status: accepted
---

# Producers generate schemas from the spec; bundles are validated against it

Producers build their Arrow/parquet schemas from generated artifacts
(`generated/cpp/bundle_schemas.h`, `generated/csharp/BundleSchemas.cs`) rather than
hand-declaring `arrow::schema({...})`, and a conformance validator checks any real
bundle against the spec (columns present, relation/node ids known and not retired).
Together these replace the previously hand-maintained guarantee that the native
extractor stayed "byte-for-byte identical to the managed EnvelopeWriter."

The real requirement is **logical conformance** — a consumer cannot tell which
producer emitted a bundle, and no producer can silently drift from the contract — not
literal parquet byte-identity. **Generation** delivers this structurally (both
producers build from one schema → identical column names, types, order by
construction); **validation** delivers detection (CI checks a freshly emitted bundle).
We keep both: generation prevents drift at the source, validation catches anything
that doesn't fully adopt generation or that affects consumers.

## Considered options

- **Validation only (detection).** Insufficient alone: the producer still hand-writes
  schemas and can drift; you find out at CI time. (This is what first caught the
  missing `nodes.subtype` column — useful, but prevention is stronger.)
- **Generation only (prevention).** Insufficient alone: it constrains schema shape but
  not emitted *values* (e.g. a relation id outside the live set), and doesn't cover
  consumer-affecting invariants.

## Consequences

- The manual native-vs-managed byte-identity check is superseded by "both validate
  against the one spec."
- **Out of scope:** literal parquet byte-identity. It depends on Arrow writer settings
  (encoding, compression, row-group sizing, writer version) the spec does not control;
  if ever needed (e.g. whole-bundle content-hash dedup), it is a separate
  writer-settings concern, not a spec guarantee.
