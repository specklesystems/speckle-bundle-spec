# Textures, placement looks and display state

> Why the bundle carries texture images, unresolved texture references, a per-placement
> material and a hidden flag the way it does, and why some requested slots were not added.
> The columns and per-column notes are in [`../reference.md`](../reference.md), generated
> from `spec/bundle-spec.sql`. Decided on
> [ENG-11304](https://linear.app/speckle/issue/ENG-11304) for the Navisworks reader
> (`navisextract`); every slot is named for what it means, not for Navisworks, because
> SketchUp, Revit and other writers have textures and overridden looks too.

## What the bundle gains

| Need | Where it goes | Status |
|---|---|---|
| Texture images | `textures` file: one row per distinct image, sharded like `geometries` | new optional file |
| Texture slots and unresolved references | `material_textures` file: one row per slot of a MATERIAL | new optional file |
| How an image sits on the UVs | `material_textures.uv_transform` | new column (in the new file) |
| Per-vertex UVs | SGEO `HasUvs` (flag bit 5), one `f64` (u, v) per vertex | already there |
| Per-vertex normals | SGEO `HasNormals` (flag bit 4), one `f64` (x, y, z) per vertex | already there |
| A material per placement | rel 31 `INSTANCE_HAS_MATERIAL` | new rel, `reserved` |
| The assigned material beside the drawn look | rel 32 `ASSIGNED_MATERIAL` | new rel, `reserved` |
| Hidden | eav root path `hidden` (value_boolean) | documented path |
| Lines, points, text | SGEO `Polyline` (2), `Points` (7), `Text` (12) | already there |

The new rels are `reserved` until a writer emits them; the writer's adoption PR flips them to
`live` and adds itself to `emitted_by`.

## Texture bytes are a blob file, not node columns

A texture is an image file of a few kilobytes to tens of megabytes. Nodes are fixed-column
structural scaffolding ([ADR-0001](../adr/0001-nodes-are-fixed-column-scaffolding.md)), and
the INSTANCE scan over them is the hot read, so bytes can't go there. They go where geometry
bytes already go: a blob file, content-hash deduped (`id` = SHA-256 of the bytes), sharded
by the geometries scheme, and outside the `eav`/`envelope` groups so that query engines,
which mount every `{base}.eav.*` and `{base}.envelope.*` file as a view, never mount it. A
conformance check now holds every sharded table to that.

The bytes are the file as found. Producers don't decode or re-encode images, so `format` is
sniffed from the leading bytes and a consumer can meet one it can't decode.

## Slots are rows, not a node kind

A slot has its own attributes: role, order, the reference as stored, a resolution status
and an image placement. A relation carries only `(rel, src, dst, ord)`, so a TEXTURE node
kind with a MATERIAL→TEXTURE rel would push those attributes onto `nodes` as columns that
one kind uses. A side table keyed by the MATERIAL's node K keeps `nodes` as it is, like
`camera_views` and `property_set_definitions` beside the core tables.

Roles are `diffuse | bump | other`, the set the Navisworks SDK reports, with `property`
naming the source property so `other` slots stay distinguishable. A diffuse image replaces
the RGB of the material's `argb` where drawn; `argb` stays the colour for consumers that
draw no textures.

## An unresolved reference travels as the reference

Most Navisworks texture references point into the authoring application's material library
and carry no bytes: 7,366 of 8,019 JSON-asset references and 3,803 of 4,130 Protein
references in the test corpus. The SDK resolves what it can (embedded bytes, caller remaps,
the saved location, the path, the file name, caller search directories) and looks nothing
up in a library install of its own.

So every slot keeps `uri` (as the source stores it) and `saved_location` (the absolute path
the source recorded at save time, when it recorded one), whether or not bytes were found,
and `status` says what happened:

| status | texture | Meaning |
|---|---|---|
| `resolved` | set | The bytes are in `textures` |
| `not_found` | NULL | A path the producer could not read |
| `url` | NULL | A reference with a URL scheme; the producer fetched nothing |
| `invalid` | NULL | A reference that names no file |

A receiver that has the library resolves a `not_found` slot against its own files, in order:
`saved_location`; `uri` as a path, absolute as is or relative against each library root it
has; the file name of `uri` in each library root. It reads the bytes itself; the bundle is
not rewritten. A `url` slot is fetched only by a receiver whose policy allows network
access, and an `invalid` one never.

The statuses are the receiver's question ("can I try to find this, and how?"), not the
producer's diagnosis. The Navisworks SDK's six statuses map onto them: `found` →
`resolved`; `not_found`, `foreign_resource` (a resource in another file) and
`outside_roots` (a path outside the directories the producer may read) → `not_found`;
`url` → `url`; `invalid` → `invalid`. The `uri` string keeps the form, so nothing a
receiver could use is lost.

## UVs stay on the geometry; the image placement is per slot

SGEO meshes already carry one UV set per vertex. What a UV means was undefined, because no
bundle consumer drew textures. `uv_transform` defines it per slot: a 2×3 affine from the
mesh's UVs to image coordinates, with (0, 0) at the image's bottom-left corner, s to the
right, t up and one image per unit, repeating. A writer whose UVs already are image
coordinates writes the identity. NULL means the producer could not place the image: the
reference still travels, and a consumer draws no image from that slot.

Baking image coordinates into the mesh was the alternative. It fails twice in Navisworks:
geometry is shared by placements whose looks differ (the next section), and one material's
diffuse and bump maps can have different placements. A transform on the slot keeps one mesh
right for every look that uses it.

For `navisextract` the mesh's UVs are the stored UVs, and the transform comes from the SDK's
`place_image`. Its rule is linear in the UVs in every case it accepts, so the adapter reads
the matrix off three probe UVs, (0, 0), (1, 0) and (0, 1), and writes NULL wherever
`place_image` fails.

## A material per placement overrides the geometry's

Navisworks stores the look on each placement of a geometry record, and saved appearance
overrides are baked into it, so placements of one record can differ. The bundle dedupes
geometry by content too, which merges equal records further. `HAS_MATERIAL` sits on the
geometry, so only one look survives today.

`INSTANCE_HAS_MATERIAL` (31) gives an INSTANCE its own look. It **overrides** the
geometry's `HAS_MATERIAL` for every geometry drawn through that INSTANCE, nested
definitions included, and with nested placements the nearest INSTANCE carrying the edge
wins. The ladder is `INSTANCE_HAS_MATERIAL` > `HAS_MATERIAL` > `OBJECT_HAS_MATERIAL` >
`NODE_HAS_MATERIAL`.

- **Override, not fill.** With fill semantics a producer would have to drop `HAS_MATERIAL`
  from shared geometry, and every consumer that reads only `HAS_MATERIAL` (the viewer today)
  would lose the colour. With override, producers keep writing `HAS_MATERIAL`, and an old
  consumer still draws one of the looks, which is what it draws now.
- **Not the object plane.** One object can own several INSTANCE nodes with different looks
  (an item whose shapes have different looks), so `OBJECT_HAS_MATERIAL` (26) can't tell them apart. Ruling
  that 26 may override would change the meaning of bundles already written, which is a major
  bump; a new top tier changes nothing an old bundle says, because old bundles carry no
  rel 31.

## The assigned material is a separate, non-render edge

Navisworks keeps an item's source material after a saved appearance override changes what
is drawn. IFC has the same split between a material association and a presentation style.
`ASSIGNED_MATERIAL` (32) links an object to the material its authoring application assigned.
It is never a render edge and the material ladder ignores it, so a consumer drawing every
material edge can't draw the wrong look. A producer writes it only where the source keeps
an assignment that differs from what is drawn.

## Hidden is an eav row; Required and item type are properties

`hidden` (value_boolean) on an object is true when the source does not draw the object as
saved, by its own hidden state or that of an ancestor it is drawn under. It is the drawn
state, not the stored per-node flag, because containers are nodes with no attributes of
their own: a layer's hidden flag would otherwise have nowhere to go, and a consumer could not
work out what is drawn. Producers write only `true` rows.

Navisworks' Required flag and its item type (file, geometry, layer, collection, insert,
composite object, group) are source facts with no consumer behaviour attached, so they stay
ordinary property rows. Containers keep the existing subtypes: `Layer` and `Collection` are
levels of the `IN_COLLECTION` tree, and `Group` stays the overlapping `IN_GROUP` axis. A
Navisworks group is a single-parent tree level, so it is a `Collection`, not a `Group`.

## Lines, points and text use the SGEO kinds that exist

- **Line strips** are SGEO `Polyline` blobs, one per strip. SGEO polylines have no colour
  channel. A strip whose vertices share one colour gets it through `HAS_COLOR` (6), the
  display-colour channel CAD writers already use for curves. A strip whose colours vary has
  no exact slot; per-vertex colours on polylines would be an SGEO format change, which
  speckle-sharp-sdk owns.
- **Point sets** are SGEO `Points`, with per-point colours (`HasColors`). The Navisworks
  snap-point flag is not carried: no consumer reads it, and a slot for it would be
  Navisworks-only. Snap points ship as points.
- **Text** is SGEO `Text`: a string, height, alignment and plane. The stored Navisworks text
  parameters are mostly of unknown meaning, so they are not carried as raw numbers; a
  producer writes `Text` geometry once it can derive the plane and height, and the string
  stays a property until then.

## What was not added

- **Render parameters as stored** (glossiness or roughness, metalness, cut-out, specular,
  emission, with property ID and unit). The file doesn't hold their conventions, so no
  consumer can draw from them, and MATERIAL's PBR columns are the render contract. Carrying
  open-ended, source-specific values on MATERIAL nodes is ADR-0001's revisit trigger and
  deserves its own decision when a consumer asks for them (a likely shape: a
  `material_parameters` side table keyed like `material_textures`).
- **Analytic circles and cylinders.** Producers tessellate them; normals ride `HasNormals`.
- **A GUID column.** `objects.application_id` carries the id, and the GUID stays a property.
- **A reader field.** `meta.produced_by` already names the producer.

## Adoption

Writers pin the spec exactly, so each needs an adoption PR when this ships; the generated
schemas gain the new files' columns, and a writer that writes none of them changes nothing
else.

- **navisextract**: `textures` and `material_textures` from the SDK's textures batch and
  material slots; UVs as stored with `uv_transform` from `place_image`; normals from the
  records and the tessellator; `INSTANCE_HAS_MATERIAL` on each INSTANCE whose look differs
  from its geometry's `HAS_MATERIAL`; `ASSIGNED_MATERIAL` from the node's source material;
  `hidden` rows; line strips, points and text as above. It flips rels 31 and 32 to `live`.
- **Other writers with textures** (SketchUp, Revit): image-space UVs with the identity
  `uv_transform`, and the same unresolved-reference columns for library images.
- **Consumers**: the viewer and server read none of this yet. Until they do, bundles render
  as they do today.
