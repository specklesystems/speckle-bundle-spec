-- ════════════════════════════════════════════════════════════════════════════
--  SGEO binary format — vocabulary SINGLE SOURCE OF TRUTH
-- ════════════════════════════════════════════════════════════════════════════
--  This file IS the spec for SGEO's enums. It is executable DuckDB SQL:
--    • CREATE TABLE + INSERT …   → the semantic catalogs (sgeo_primitive_types,
--                                  sgeo_flags) — the "why" rides as columns
--
--  SGEO is the binary geometry blob format inside geometries.content (16-byte
--  header + per-primitive body) — its OWN format, deliberately NOT part of the
--  bundle table spec (bundle-spec.sql): nothing here ships as a parquet table;
--  SGEO headers are self-describing bytes. Body layouts, conventions, the
--  implementation census and audit live in docs/rationale/sgeo-format.md,
--  which defers to this file for the enums.
--
--  Claiming rule: a primitive code or flag bit is claimed HERE first,
--  implementations follow; ids/bits are RETIRED IN PLACE, never re-purposed.
--  (Bit 10 was nearly double-claimed in Aug 2026 while live in dwgextract —
--  the incident this file exists to prevent.) Decoders must mask known bits
--  and ignore unknown ones. Edit this file; conformance tests load it
--  standalone — it must execute clean in DuckDB with no other file.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE sgeo_primitive_types (
  id          INTEGER PRIMARY KEY,
  name        VARCHAR NOT NULL,
  status      VARCHAR NOT NULL,   -- assigned | free
  description VARCHAR
);
INSERT INTO sgeo_primitive_types VALUES
  (0,  'mesh',      'assigned', 'Mesh — SMSH body under the SGEO header; faces keep the SDK n-gon encoding [n,i0..i(n-1)].'),
  (1,  'line',      'assigned', 'Line — domain + start/end, 8 doubles.'),
  (2,  'polyline',  'assigned', 'Polyline — count-prefixed xyz triples; closed rides flag bit 1.'),
  (3,  'polycurve', 'assigned', 'Polycurve — recursive: length-prefixed nested SGEO blobs per segment.'),
  (4,  'curve',     'assigned', 'NURBS curve — leading displayValue polyline (render), trailing full definition (analytical).'),
  (5,  'arc',       'assigned', 'Arc — plane + 3 points + domain; radius/measure derived on read.'),
  (6,  'circle',    'assigned', 'Circle — radius + domain + plane, 15 doubles.'),
  (7,  'points',    'assigned', 'Point (count=1) or Pointcloud — optional colors (bit 6) and sizes (bit 7).'),
  (8,  'ellipse',   'assigned', 'Ellipse — radii + domain + plane; trimDomain rides flag bit 8.'),
  (9,  'spiral',    'assigned', 'Spiral — leading displayValue polyline, trailing analytic definition.'),
  (10, 'box',       'assigned', 'Box — plane + three size intervals; area/volume derived.'),
  (11, 'region',    'assigned', 'Region — boundary + inner loops as nested SGEO curve blobs; hatch props ride eav.'),
  (12, 'text',      'assigned', 'Annotation text — parametric (alignment/height/plane/utf8 value), not tessellated glyphs.');
COMMENT ON TABLE sgeo_primitive_types IS 'SGEO header primitive_type codes (offset 0x05, one byte). Spec-side catalog — not a bundle file. Codes are retired-in-place like every id space in this spec.';

--   applies_to : csv of primitive names the bit is meaningful for
--   status     : assigned | reserved | free
CREATE TABLE sgeo_flags (
  bit         INTEGER PRIMARY KEY,
  name        VARCHAR,
  applies_to  VARCHAR,
  status      VARCHAR NOT NULL,
  description VARCHAR,
  why         VARCHAR
);
INSERT INTO sgeo_flags VALUES
  (0,  'Quantized',      NULL,                        'reserved', 'Reserved for a future quantized layout — must be 0 in v1.', 'Decoders reject it explicitly (the one bit that IS checked), so claiming it later is a format-version event, not an additive bit.'),
  (1,  'Closed',         'polyline,curve,polycurve',  'assigned', 'The curve is a closed loop.',                               NULL),
  (2,  'Rational',       'curve',                     'assigned', 'Curve has non-uniform weights (weights array present).',    NULL),
  (3,  'Periodic',       'curve',                     'assigned', 'Curve is periodic.',                                        NULL),
  (4,  'HasNormals',     'mesh',                      'assigned', 'Body carries per-vertex normals.',                          NULL),
  (5,  'HasUvs',         'mesh',                      'assigned', 'Body carries texture coordinates.',                         NULL),
  (6,  'HasColors',      'mesh,points',               'assigned', 'Body carries per-vertex/per-point ARGB colors.',            NULL),
  (7,  'HasSizes',       'points',                    'assigned', 'Pointcloud carries per-point sizes.',                       NULL),
  (8,  'HasTrimDomain',  'ellipse',                   'assigned', 'Ellipse carries a trim domain.',                            NULL),
  (9,  'ScreenOriented', 'text',                      'assigned', 'Text is camera-aligned (plane axes ignored).',              NULL),
  (10, 'HasMaxWidth',    'text',                      'assigned', 'Text has a wrap width (maxWidth field present).',           'dwgextract already emits this on MText with a width — bit 10 is LIVE in shipped bundles; it was nearly double-claimed in Aug 2026, which is why this catalog exists.'),
  (11, 'HardEdges',      'mesh',                      'assigned', 'Rebuild the mesh with hard (unsoftened) edges.',            'INVERTED polarity on purpose: set = hard edges, unset = the legacy soften-on-receive default — so every existing bundle (bit never set) keeps its current meaning with no version bump. Successor of the SketchUp @speckle.is_soften eav path (unset ⇒ soften matches the shipped `!= false` default). Lives in the hashed bytes, so softness participates in content-hash identity — dedup-correct, same principle as the ENG-9124 material-key salting. All four decoders mask known bits only (audited), so setting it is safe against the deployed fleet.'),
  (12, NULL, NULL, 'free', NULL, NULL),
  (13, NULL, NULL, 'free', NULL, NULL),
  (14, NULL, NULL, 'free', NULL, NULL),
  (15, NULL, NULL, 'free', NULL, NULL);
COMMENT ON TABLE sgeo_flags IS 'SGEO header flag bits (offset 0x06, uint16 bitfield). Spec-side catalog — not a bundle file. Bits are claimed here FIRST, implementations follow; a bit is never re-purposed. Decoders must mask known bits and ignore unknown ones (all audited decoders do).';

