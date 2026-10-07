# eav sort order and `path_stats`

Schema notes for `eav`, `type_eav` and `path_stats` are in [`../reference.md`](../reference.md).
This note covers why their row order is part of the format.

## The problem

Most interactive reads filter `eav` by path: a dashboard filter on a level, a scene-explorer
facet, an agent asking for every object with a fire rating. In Parquet, a reader can skip a
row group only when that group's `path_index` min/max excludes the path asked for.

A producer that writes `eav` in its own walk order (one object's rows, then the next) puts
nearly every path into every row group. The min/max then spans the whole path range, nothing
is skipped, and every path filter reads the full table.

Measured on two versions of one Revit model, one written in object order and one sorted by
path:

| | Object order | Sorted by path |
| -- | -- | -- |
| Contiguous runs of rows per path | ~709,000 | ~321 |
| Same path-filtered query | 110–160 ms | 37–43 ms |

Sorting also shrinks the file. On a 274M-row bundle the sorted `eav` was 4.4× smaller, but
only when written as Parquet V2. Under V1, `object_index` overflows its dictionary and the
sorted file grows instead.

## The rule

- `eav` SHOULD be sorted by `(path_index, object_index)` and `type_eav` by
  `(path_index, type_index)`.
- A producer that writes `path_stats` MUST sort both. `path_stats` is how a consumer knows
  the sort happened.
- A producer that cannot sort (for example a streaming writer with no post-pass) omits
  `path_stats`. The bundle is valid, just slower to filter.

Requiring the sort for every bundle would make every existing object-ordered bundle
non-conforming, which is a breaking change. Tying it to an optional file keeps the change
additive: old bundles stay valid, and consumers can tell the two layouts apart.

## Why the sort and `path_stats` ship together

Consumers that estimate path statistics without `path_stats` sample row groups. Sampling is
only representative when each row group is a cross-section of all paths, which is true of
object-ordered files and false of sorted ones; on a sorted file a sampled row group covers
one or two paths.

So a consumer reads "`path_stats` present" as "sorted, use the stats" and "absent" as
"object-ordered, sample". The unsafe state is a sorted `eav` with no `path_stats`: a
consumer samples it and gets badly wrong estimates. A producer therefore writes
`path_stats` before, or atomically with, replacing `eav`:

- stats with an unsorted `eav` is valid, because the stats don't depend on order;
- sorted `eav` without stats must never happen.

## Population

`path_stats` summarises the `object_properties` population: instance `eav` rows UNION ALL
`type_eav` rows resolved to objects through `object_type`. Counting `eav` alone would miss
every type-scoped parameter. `object_count` is therefore the number of objects that carry
the path either way. A type parameter shared by 500 objects counts 500.

## Producers

- **Native converters:** the dispatch post-pass (`speckle-converters`
  `dispatch/src/dispatch/postpass.py`) sorts and writes `path_stats` between conversion and
  upload.
- **Bundle migrator:** `speckle-sharp-sdk` `src/Speckle.Sdk.BundleMigrator`, the same pass,
  ENG-10508.

Both treat the pass as best-effort. Each sorted file is checked against its source (row
count plus an order-insensitive hash over every column) before it replaces anything, and on
any failure the bundle ships object-ordered without `path_stats`. That is valid under the
rule above.
