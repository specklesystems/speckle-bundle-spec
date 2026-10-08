# Speckle.Bundle.Spec

The Speckle bundle format vocabulary for .NET, generated from the executable spec in
[speckle-bundle-spec](https://github.com/specklesystems/speckle-bundle-spec):
`Rel` / `NodeKind` enums, the `Catalog` rows a producer ships, per-table column
descriptors (`BundleSchemas`), column-index constants (`BundleCols`), and one record per
node kind and row-shaped table.

`BundleSpec.SchemaVersion` equals the package version and is the `meta.schema_version`
a writer stamps into every bundle.

Writers pin an exact version: an additive spec release shifts the generated column
indices, so adopting it is a code change.
