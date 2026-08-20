# SGEO — the binary geometry format (v1)

The byte format inside `geometries.content` (and nested inside polycurve/region
bodies). One opaque blob per geometry: a fixed 16-byte header + a per-primitive
body. This document + the `sgeo_primitive_types` / `sgeo_flags` catalogs in
[`spec/sgeo-spec.sql`](../../spec/sgeo-spec.sql) (SGEO's own executable spec file, standalone from the bundle table spec) are the **source of truth**;
the implementations listed in the census below mirror it and must match.

Ported from the format's original spec (`speckle-sharp-sdk/plans/speckle-4.0/
sgeo-binary-format.md`) during the Aug-2026 flag-claim audit; that document
remains as design history, this one governs.

## Header (16 bytes, little-endian)

```
0x00  4  magic           "SGEO"  (0x53 0x47 0x45 0x4F)
0x04  1  version         = 1
0x05  1  primitive_type  → sgeo_primitive_types catalog
0x06  2  flags           uint16 bitfield → sgeo_flags catalog
0x08  2  units_code      uint16 (none=0 mm=1 cm=2 m=3 km=4 in=5 ft=6 yd=7 mi=8)
0x0A  2  reserved        = 0
0x0C  4  crc             CRC-32 of body bytes only (0x10..end)
0x10  …  body            per primitive_type
```

Conventions: little-endian; `f64` = IEEE-754 double; body starts 8-aligned at
0x10 and every f64 array stays 8-aligned (u32 scalars written in pairs / padded)
so a JS `Float64Array` can view the buffer zero-copy. Derived fields (length,
area, volume, bbox, arc radius/measure) are never stored. One unit per blob;
composite sub-objects' own units are dropped. `applicationId` is NOT in the blob
(it is the `geometries` column) — **the blob is pure geometry**; the only
non-shape semantics allowed are the header flags cataloged in the spec.

CRC is canonical CRC-32 (IEEE 802.3, reflected poly `0xEDB88320`, = `zlib.crc32`)
over the body only, so a units edit doesn't invalidate it. History: an early
non-standard `0xEDB88820` variant shipped briefly and was fixed in lockstep
across producers; the ruby decoder deliberately skips CRC verification to stay
lenient to stray pre-fix blobs.

## Flags (offset 0x06) — see `spec/sgeo-spec.sql` for the authoritative rows

| bit | name | applies to |
|---|---|---|
| 0 | Quantized | *reserved — decoders reject it* |
| 1 | Closed | polyline, curve, polycurve |
| 2 | Rational | curve |
| 3 | Periodic | curve |
| 4 | HasNormals | mesh |
| 5 | HasUvs | mesh |
| 6 | HasColors | mesh, points |
| 7 | HasSizes | points |
| 8 | HasTrimDomain | ellipse |
| 9 | ScreenOriented | text |
| 10 | HasMaxWidth | text — **live in shipped dwgextract bundles** |
| 11 | **HardEdges** | mesh — claimed Aug 2026, see below |
| 12–15 | — | free |

**Bit 11 — HardEdges (mesh).** Set ⇒ receiving apps rebuild the mesh with hard
(unsoftened) edges; unset ⇒ the legacy soften-on-receive default. The polarity is
deliberately inverted from "is_soften" so that every existing bundle — where the
bit was never written — keeps its current meaning without a format-version bump.
It succeeds the SketchUp `@speckle.is_soften` eav path (whose shipped default was
soften-when-absent, `!= false`). Because the flag lives in the hashed bytes,
softness participates in content-hash identity: a hard-edged and a soft mesh with
identical vertices are *different geometries* (they rebuild differently) — the
same principle as the ENG-9124 material-key salting. Receive ladder for
consumers: bit 11 → hard; else `@speckle.is_soften` eav (transitional bundles);
else soften.

**Claiming rule:** a bit is claimed in the `sgeo_flags` catalog FIRST,
implementations follow; bits are never re-purposed. This exists because bit 10
was nearly double-claimed in Aug 2026 — an early draft assumed bits 10–15 were
free while `HasMaxWidth` (bit 10) was already live in dwgextract text blobs.
Decoders MUST mask the bits they know and ignore the rest (all audited decoders
do; only Quantized is deliberately rejected).

## Primitive bodies

The per-type body layouts (field order, types, count-prefixes, alignment padding)
are specified in full in the original spec document and verified against the
reference encoder (`SgeoEncoder.cs`) during the Aug-2026 audit; the summaries:

- **0 mesh** — `u32 vertex_count, u32 face_index_count, f64[v*3] vertices,
  i32[fic] faces [n,i0..]…` (pad to 8B) `+ f64[v*3] normals (bit4) + f64[v*2]
  uvs (bit5) + i32[v] colors (bit6)`.
- **1 line** — `f64 domain.start, domain.end, start.xyz, end.xyz` (64 B).
- **2 polyline** — `u32 point_count, u32 rsv, f64[n*3]`; Closed = bit 1.
- **3 polycurve** — `u32 segment_count, u32 rsv`, then per segment
  `[u32 blob_len][u32 rsv][nested SGEO blob][pad8]` — length-prefixed so a
  decoder can skip unknown segment types.
- **4 curve** — leading displayValue polyline (render path reads it like type 2
  and stops), trailing full NURBS definition (`degree, cp_count, knot_count,
  rsv, domain, control_points, weights (bit2), knots`) at
  `def_off = 0x18 + display_point_count*24`.
- **5 arc** — plane (origin/normal/xdir/ydir) + start/mid/end points + domain
  (184 B).
- **6 circle** — radius + domain + plane (120 B).
- **7 points** — `u32 count, u32 rsv, f64[n*3] + i32[n] colors (bit6, pad8) +
  f64[n] sizes (bit7)`.
- **8 ellipse** — radii + domain + plane `+ trimDomain (bit8)`.
- **9 spiral** — leading displayValue polyline + trailing analytic definition
  (spiral_type enum, points, plane, turns, pitchAxis, pitch, domain).
- **10 box** — plane + xSize/ySize/zSize intervals (160 B).
- **11 region** — `u32 hasHatchPattern, u32 inner_loop_count`, boundary + loops
  as nested SGEO blobs (polycurve framing). Hatch pattern/rotation/scale ride
  eav — the blob is boundary geometry only.
- **12 text** — `u32 alignH, u32 alignV, f64 height, [f64 maxWidth bit10],
  plane, [u32 byteLen][u32 rsv][utf8 value, pad8]`. ScreenOriented = bit 9.
  `height` is linear units, or pixels when `units_code = 0`.

Fidelity types (`Brep`, `BrepX`, `ExtrusionX`, `SubDX`, `SolidX`) are not SGEO
primitives — their authoritative definitions route to raw-encoding storage and
their displayValue meshes ship as ordinary type-0 rows.

## Implementation census (Aug 2026)

| # | repo | file | role | primitives |
|---|---|---|---|---|
| 1 | speckle-sharp-sdk | `Speckle.Objects/Utils/SgeoFormat.cs` + `SgeoEncoder.cs` | C# encode (reference) | all 13 |
| 2 | speckle-sharp-sdk | `Speckle.Objects/Utils/SgeoDecoder.cs` | C# decode (receive) | mesh (+header for all) |
| 3 | speckle-sketchup | `artifacts/sgeo_encoder.rb` | ruby encode | mesh (+lines via native) |
| 4 | speckle-sketchup | `artifacts/sgeo_decoder.rb` | ruby decode (receive) | mesh, curves |
| 5 | speckle-server-internal | `viewer/.../decodeSgeo.ts` | TS decode (viewer) | render set |
| 6 | specklepy | `bundle/sgeo.py` | python encode (IFC) | mesh+ |
| 7 | speckle-converters | `native/core/sgeo.h` | C++ encode (rv/nw/skp) | mesh, line |
| 8 | speckle-converters | `native/{dwg,dgn}extract/src/sgeo_curves.h` | C++ encode (curves/text) | polyline…text |
| 9 | speckle-converters | `datgen/src/core/bundle-loader/sgeoDecoder.ts` | TS decode (datgen) — **vendored copy of #5** | mesh |

Nine hand-synced copies, no codegen, no shared conformance vectors. **Sync
discipline:** this doc + the two catalogs govern; a change lands here first,
then fans out. Codegen of sgeo constants (mirroring `bundle_cols`) is future
work — worth doing before the next bit claim.

## Implementation audit (2026-08-18, at the bit-11 claim)

Per-decoder unknown-bit behavior (the question that gates any new bit):

| decoder | unknown bits | notes |
|---|---|---|
| C# `SgeoDecoder.cs` | **ignored** (masks known) | rejects Quantized explicitly; validates magic/version/CRC |
| ruby `sgeo_decoder.rb` | **ignored** | deliberately skips CRC verification (pre-fix leniency, commented at :32) |
| viewer `decodeSgeo.ts` | **ignored** | rejects Quantized only (`:459` returns 'unsupported') |
| datgen `sgeoDecoder.ts` | **ignored** | copy of the viewer's; mesh-only, throws on non-mesh |

⇒ setting bit 11 today is safe against every deployed decoder.

Findings:

1. **Near-collision on bit 10** (the audit's reason to exist): `HasMaxWidth` is
   assigned AND live — `dwgextract/src/sgeo_curves.h:28` (`kFlagHasMaxWidth =
   1024`) emitted on MText with width (`text_dwg.h:223`). An Aug-2026 draft
   assumed 10–15 free. Resolved: HardEdges = bit 11; catalog-first claiming rule
   adopted.
2. **Constant drift risk, currently in sync**: `dwgextract` and `dgnextract`
   carry near-identical `sgeo_curves.h` copies (dgn lacks text); flag values
   verified equal (2/4/8/256/512/1024). `datgen`'s decoder is a vendored copy of
   the viewer's. Three copy-pairs to keep honest.
3. **Dead vocabulary (by design, worth knowing)**: native `core/sgeo.h` mesh
   encoder hardcodes `flags=0` (`:186`) — native producers never emit
   normals/uvs/colors (bits 4–6); consumers recompute normals. Ruby encoder
   writes bits 4–6 only. `HasSizes` (bit 7) has no known producer today.
4. **CRC**: polynomial history above; specklepy `sgeo.py:88` has a stale section
   comment saying `0xEDB88820` while the code correctly uses `zlib.crc32`
   (cosmetic; worth fixing on next touch).
5. **No pure-geometry violations found**: applicationId stays out of blobs;
   region hatch properties ride eav; text is parametric not tessellated. The
   flags field is the only sanctioned non-shape channel, and every assigned bit
   describes the geometry itself.

## Follow-ups

- Wire `HardEdges` into: C# encoder/decoder, ruby encoder+decoder + the SketchUp
  receive ladder (bit → `@speckle.is_soften` fallback → soften), viewer +
  datgen decoders (no-op is acceptable there), then retire the
  `@speckle.is_soften` eav path from SketchUp send.
- sgeo constants codegen across the nine implementations.
- Fix the specklepy comment typo; consider a shared golden-vector test corpus.
