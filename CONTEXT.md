# Speckle bundle format

The ubiquitous language of the **bundle** — the flat, parquet-based artifact a
producer emits and the viewer/server consume. The schema itself is in
`spec/bundle-spec.sql`; this file defines the *words*.

## Data model

**Bundle**:
The whole artifact — a set of parquet files comprising the `eav` data store, the
`envelope` graph, and the `geometries` blobs, plus self-describing catalogs.

**eav**:
The flat entity-attribute-value store. Each object has unbounded `(path, value)`
rows; properties are not nested. The unbounded, source-variable half of the model.
_Avoid_: properties blob, props dictionary.

**Envelope**:
The graph laid *beside* the flat data: synthetic `nodes` plus typed `relations`.
Hierarchy and relationships live here, never nested in the objects.

**Object**:
An atomic source element, identified by its `application_id`. Its attributes are
eav rows; the objects table itself is pure identity. Rooms and MEP spaces are
objects (they carry geometry), not nodes.

## Graph

**Node**:
A synthetic graph vertex (DEFINITION, INSTANCE, MATERIAL, COLOR, LEVEL, CONTAINER).
Bounded *structural scaffolding* with a fixed column set — not a metadata bag.
See [ADR-0001](docs/adr/0001-nodes-are-fixed-column-scaffolding.md).

**Relation** (rel):
A typed directed edge `(rel, src, dst, ord)`. `src`/`dst` are interpreted via the
rel's namespaces. Catalogued in `rel_types`.
_Avoid_: edge (in prose), link.

**CONTAINER**:
The single polymorphic grouping node (kind 7). Nests into a tree via `def_ref`;
its **subtype** (`Collection` | `Model` | `MEP System` | `Network`) is its only
discriminator. Absorbed the former COLLECTION kind and the IN_NETWORK grouping.

**subtype**:
The discriminator column on a CONTAINER. The single axis of grouping polymorphism
— replaced the earlier overload of the `units` column.

**MATERIAL / COLOR**:
Two deliberately separate node kinds. MATERIAL is a full-PBR render asset
(HAS_MATERIAL); COLOR is a raw colour override (HAS_COLOR). Kept distinct because
they drive different viewer render modes and an object can carry both.

**ord**:
The fourth column of a relation, dual-use: an **ordinal** for ordered rels
(DISPLAY, SUBELEMENT, *_INSTANCE), or a **scope** tag for graph edges
(CONNECTS_TO `ord` = system-K / opening-K, 0 = unscoped).

## Identity

**K** (K-space):
A dense integer id space. Three coexist: **object K** (`objects.object_index`),
**node K** (`nodes.id`), and **geometry K** (`geometries.geometryIndex`). Node K
and geometry K overlap numerically — disambiguated by a relation's namespaces.
_Avoid_: index (ambiguous), id (ambiguous).

**namespace** (src_ns / dst_ns):
On each rel type, declares which K-space its `src`/`dst` reference: `object` |
`node` | `geometry` | `geometry|object`.

## Spec & roles

**Producer**:
A writer that emits bundles: `rvextract` (native Revit, C++), `nwextract`
(native Navis, C++), or `managed` (the C# EnvelopeWriter).

**Consumer**:
A reader of bundles: the viewer geometry path (`buildDatFromBundle`) and the
server query layer (`bundleQueries`). Reads via DuckDB.

**Catalog**:
A self-describing table shipped *in* the bundle so a consumer needs no prior
knowledge: `rel_types`, `node_kinds`, `meta`, `scene_views`.

**status**:
A vocabulary entry's lifecycle: `live` (emitted), `reserved` (in the vocabulary,
not yet emitted — e.g. SOLID), `retired` (id kept forever, never reused).

**Sharded**:
A table rolled across multiple files (only `geometries`): shard 0 is the canonical
`{base}.geometries.parquet`, overflow shards `{base}.geometries.{N}.parquet`; read
the glob `{base}.geometries*.parquet`.

**schema_version**:
The semver string in `meta` stamping which spec release a bundle was built
against — equal to this package's version (currently `1.0.0`).
