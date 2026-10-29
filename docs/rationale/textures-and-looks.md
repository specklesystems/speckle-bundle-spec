# Textures, placement looks and display state

> Why the bundle carries texture images, unresolved texture references, a per-placement
> material and a hidden flag the way it does, and why some requested slots were not added.
> What each column means is in [`../reference.md`](../reference.md) (`textures`,
> `material_textures`, rels 31 and 32), generated from `spec/bundle-spec.sql`; this essay
> doesn't repeat it. Decided on [ENG-11304](https://linear.app/speckle/issue/ENG-11304) for
> the Navisworks reader (`navisextract`). Every slot is named for what it means, not for
> Navisworks, because SketchUp, Revit and other writers have textures and overridden looks
> too.

## What the bundle gains

| Need | Where it goes | Status |
|---|---|---|
| Texture images | `textures` file | new optional file |
| Texture slots, unresolved references, image placement | `material_textures` file | new optional file |
| Per-vertex UVs | SGEO `HasUvs` (flag bit 5), one `f64` (u, v) per vertex | already there |
| Per-vertex normals | SGEO `HasNormals` (flag bit 4), one `f64` (x, y, z) per vertex | already there |
| A material per placement | rel 31 `INSTANCE_HAS_MATERIAL` | new rel, `reserved` |
| The assigned material beside the drawn look | rel 32 `ASSIGNED_MATERIAL` | new rel, `reserved` |
| Hidden | eav root path `hidden` | documented path |
| Lines, points, text | SGEO `Polyline` (2), `Points` (7), `Text` (12) | already there |
| Stable identity | `objects.application_id` | already there |

The new rels are `reserved` until a writer emits them. The writer's adoption PR flips them to
`live` and adds itself to `emitted_by`.

## Texture bytes are a blob file, not node columns

Nodes are fixed-column structural scaffolding
([ADR-0001](../adr/0001-nodes-are-fixed-column-scaffolding.md)), and the INSTANCE scan over
them is the hot read, so image bytes can't go there. They go where geometry bytes already
go: a blob file, deduped by content hash, sharded by the geometries scheme, and outside the
`eav`/`envelope` groups so that query engines never mount it. A conformance check holds
every sharded table to that.

## Slots are rows, not a node kind

A slot has attributes of its own (role, order, the reference as stored, a status, an image
placement), and a relation carries only `(rel, src, dst, ord)`. A TEXTURE node kind would
push those attributes onto `nodes` as columns one kind uses. A side table keyed by the
MATERIAL's node K leaves `nodes` alone, like `camera_views` beside the core tables.

The roles are the three the Navisworks SDK reports (`diffuse`, `bump`, `other`), with the
source property named on every row so `other` slots stay distinguishable. A later writer
that needs a finer role adds one in a minor version.

## An unresolved reference travels as the reference

Most Navisworks texture references point into the authoring application's material library
and carry no bytes: 7,366 of 8,019 JSON-asset references and 3,803 of 4,130 Protein
references in the test corpus. The SDK resolves what it can and looks nothing up in a
library install of its own. So every slot keeps the reference as stored and the path the
source saved, whether or not bytes were found, and a receiver that has the library resolves
it against its own files later, without rewriting the bundle.

The statuses answer the receiver's question ("can I look for this, and how?"), not the
producer's diagnosis. The Navisworks SDK's six statuses map onto them:

| SDK status | Bundle status |
|---|---|
| `found` | `resolved` |
| `not_found`, `outside_roots` | `not_found` |
| `url`, `foreign_resource` (an `nwd:` resource in another file) | `url` |
| `invalid` | `invalid` |

`outside_roots` is the producer refusing to read a path outside its allowed directories; to
a receiver it is a path like any other. `foreign_resource` has a scheme, so a receiver
resolves it only if it knows `nwd:`.

A bundle is untrusted input, so the resolution rule confines reads to the receiver's own
library roots, as the SDK confines its own reads (navisworks-sdk ADR-0003). Without that, a
crafted `saved_location` would make a receiver read any file it can reach, or open a UNC
path that leaks credentials.

## UVs stay on the geometry; the image placement is per slot

SGEO meshes already carry one UV set per vertex. What a UV means was never defined, because
no bundle consumer drew textures, so `uv_transform` defines it per slot: an affine map from
the mesh's UVs to image coordinates.

Baking image coordinates into the mesh was the alternative. It fails twice in Navisworks:
geometry is shared by placements whose looks differ (next section), and one material's
diffuse and bump maps can sit differently. A transform on the slot keeps one mesh right for
every look that uses it.

For `navisextract` the mesh's UVs are the stored UVs, and the transform comes from the SDK's
`place_image`, which is linear in the UVs in every case it accepts (offsets are refused, and
rotation is about UV (0, 0)). The adapter reads the matrix off three probe UVs, (0, 0),
(1, 0) and (0, 1), and writes NULL wherever `place_image` fails or reports
`pivot_verified = false`. That keeps the SDK as the one owner of the placement rule and
ships only placements Navisworks was checked on.

The stored placement values themselves are not carried. Where `place_image` can't place a
map, its values have no checked meaning yet (they wait on ENG-11301), so a receiver could
not use them either; when the rule widens, producers write more transforms.

## A material per placement overrides the geometry's

Navisworks stores the look on each placement of a geometry record, with saved appearance
overrides baked in, so placements of one record can differ. The bundle also dedupes
geometry by content, which merges equal records. `HAS_MATERIAL` sits on the geometry, so it
can hold only one of those looks.

`INSTANCE_HAS_MATERIAL` (31) gives an INSTANCE its own look and **overrides** the
geometry's `HAS_MATERIAL`; it is the new top of the material ladder.

- **Override, not fill.** With fill semantics a producer would have to drop `HAS_MATERIAL`
  from shared geometry, and a consumer that reads only `HAS_MATERIAL` would lose the colour.
  With override, producers keep writing `HAS_MATERIAL`, and such a consumer still draws one
  of the looks.
- **Not the object plane.** One object can own several INSTANCE nodes with different looks
  (an item whose shapes have different looks), so `OBJECT_HAS_MATERIAL` (26) can't tell
  them apart. Ruling that 26 may override would change what bundles already written mean.
- **Minor, not major.** `VERSIONING.md` makes a precedence change major because it changes
  the meaning of existing bundles. A new top tier doesn't: no existing bundle carries rel
  31, so every one resolves exactly as before.

## The assigned material is a separate, non-render edge

Navisworks keeps an item's source material after a saved appearance override changes what
is drawn; IFC has the same split between a material association and a presentation style.
`ASSIGNED_MATERIAL` (32) records the assignment, and the material ladder ignores it, so a
consumer drawing every material edge can't draw the wrong look. One edge is enough for
Navisworks: the adapter builds the assigned MATERIAL from the node's basic material (tag
31) and its asset (tag 200) together, the same way it builds the drawn look from the
placement's basic material and asset.

## Hidden is an eav row; Required and item type are properties

`hidden` records the drawn state: the object's own hidden state or-ed with that of every
ancestor it is drawn under. Containers are nodes with no attributes of their own, so a
hidden layer's flag would otherwise have nowhere to go, and a consumer couldn't work out
what is drawn. A producer that also wants the source's per-node flag keeps it as a property.

Navisworks' Required flag and its item type (file, geometry, layer, collection, insert,
composite object, group) are source facts no consumer acts on, so they stay ordinary
property rows. Containers keep the existing subtypes. `Layer` and `Collection` are levels
of the `IN_COLLECTION` tree, and `Group` stays the overlapping `IN_GROUP` axis, so a
Navisworks group, a single-parent tree level, is a `Collection`.

## Lines, points and text use the SGEO kinds that exist

- **Line strips** are SGEO `Polyline` blobs, one per strip. SGEO polylines have no colour
  channel, so a strip whose vertices share one colour gets it through `HAS_COLOR` (6), the
  display-colour channel CAD writers already use for curves. A strip whose colours vary has
  no exact slot. Per-vertex colours on polylines would be an SGEO format change, which
  speckle-sharp-sdk owns; it is worth making if the corpus shows such strips.
- **Point sets** are SGEO `Points`, with per-point colours. The Navisworks snap-point flag
  is not carried: no consumer reads it, and a slot for it would be Navisworks-only. Snap
  points ship as points.
- **Text** is SGEO `Text`: a string, height, alignment and plane. Most stored Navisworks
  text parameters have no known meaning, so they are not carried as raw numbers. A producer
  writes `Text` once it can derive the plane and height (asked on ENG-11218), and keeps the
  string as a property until then.

## What was not added

- **Render parameters as stored** (glossiness or roughness, metalness, cut-out, specular and
  emission, with property ID and unit). The file doesn't hold their conventions, so no
  consumer can draw from them, and MATERIAL's PBR columns are the render contract. Carrying
  open-ended, source-specific values on MATERIAL nodes is ADR-0001's revisit trigger and
  needs its own decision when a consumer asks for them; a `material_parameters` side table
  keyed like `material_textures` is the likely shape.
- **Analytic circles and cylinders.** Producers tessellate them, and normals ride
  `HasNormals`.
- **A GUID column.** `objects.application_id` holds the reader's minted id, and the GUID
  stays a property.
- **A reader field.** `meta.produced_by` already names the producer.

## Adoption

Writers pin the spec exactly, so each needs an adoption PR when this ships. The generated
schemas gain the new files' columns; a writer that writes none of them changes nothing else.

- **navisextract** writes `textures` and `material_textures` from the SDK's textures and
  material slots, UVs and normals on its meshes, `INSTANCE_HAS_MATERIAL` on each INSTANCE
  whose look differs from its geometry's `HAS_MATERIAL`, `ASSIGNED_MATERIAL` where the
  source material differs from the drawn look, and `hidden` rows. It flips rels 31 and 32
  to `live`.
- **Other writers with textures** (SketchUp, Revit) write image-space UVs with the identity
  `uv_transform`, and library images as unresolved slots.
- **Consumers** (viewer, server) draw textures and rel 31 once they read them; until then a
  bundle renders as one without them.
