# speckle-bundle-spec

The Speckle bundle format vocabulary for Python, generated from the executable
spec in [speckle-bundle-spec](https://github.com/specklesystems/speckle-bundle-spec):
`Rel` / `NodeKind` enums, the `REL_TYPES` / `NODE_KINDS` catalog rows a producer ships,
per-table column schemas (`BY_TABLE`), column-index constants, and one dataclass per
node kind and row-shaped table.

`SCHEMA_VERSION` equals the package version and is the `meta.schema_version` a writer
stamps into every bundle.

```python
from speckle_bundle_spec import Rel, NodeKind, SCHEMA_VERSION
```

Writers pin an exact version: an additive spec release shifts the generated column
indices, so adopting it is a code change.
