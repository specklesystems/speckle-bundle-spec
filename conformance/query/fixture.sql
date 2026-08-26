-- Query-conformance synthetic bundle. Runs AFTER spec/bundle-spec.sql (the tables and
-- catalogs already exist); every INSERT below is deterministic (range()-driven, no
-- randomness) so `npm run build:query-fixture` reproduces the same rows on every machine.
-- Sized to stay KB-scale while still spanning several parquet row groups (eav has 6000
-- rows and is written with ROW_GROUP_SIZE 2048 → 3 row groups).
--
-- Shape summary (the golden cases in cases.json are derived from these formulas):
--   objects      200 rows, object_index 0..199, application_id 'obj-NNNN'
--   paths        33 rows: 0 category, 1 name, 2 Dimensions.Area, 3 Dimensions.Length,
--                4 IsExternal, 5 Type Name, 6 Fire Rating, 7 Thickness,
--                8..32 Parameters.P1..P25
--   eav          30 rows per object (5 fixed + 25 Parameters) = 6000 rows
--   types        5 rows (type_index 0..4); type 4 is an orphan (no object points at it)
--   type_eav     3 rows per type (Type Name, Fire Rating, Thickness) = 15 rows
--   object_type  objects 0..198 → type object_index % 4; object 199 is untyped
--   nodes        12: LEVEL 0..2, CONTAINER 3, DEFINITION 4..5, INSTANCE 6..9,
--                MATERIAL 10, COLOR 11
--   relations    ON_LEVEL 200, DISPLAY 200, IN_MODEL 200, HAS_MATERIAL 5,
--                DISPLAY_INSTANCE 4, DEFINES_INSTANCE 4, HAS_COLOR 1 = 614 rows
--   geometries   10 rows (geometryIndex 0..9), written as 2 shards (0..5 | 6..9)
--   scene_views 2, camera_views 1, structural_results 3

UPDATE meta SET produced_by = 'speckle-bundle-spec/query-conformance',
                producer_version = '1', sdk_name = 'query-conformance-fixture';

INSERT INTO objects
SELECT i, 'obj-' || lpad(i::VARCHAR, 4, '0') FROM range(200) t(i);

INSERT INTO paths VALUES
  (0, 'category'), (1, 'name'), (2, 'Dimensions.Area'), (3, 'Dimensions.Length'),
  (4, 'IsExternal'), (5, 'Type Name'), (6, 'Fire Rating'), (7, 'Thickness');
INSERT INTO paths
SELECT 8 + k, 'Parameters.P' || (k + 1)::VARCHAR FROM range(25) t(k);

-- Fixed per-object attributes: one string, one name, two unit-bearing doubles, one boolean.
INSERT INTO eav
SELECT i, 0, ['Walls', 'Doors', 'Windows', 'Floors'][(i % 4) + 1], NULL, NULL, NULL, NULL
FROM range(200) t(i);
INSERT INTO eav
SELECT i, 1, 'obj-' || lpad(i::VARCHAR, 4, '0'), NULL, NULL, NULL, NULL FROM range(200) t(i);
INSERT INTO eav
SELECT i, 2, NULL, i * 1.5, NULL, 'm2', NULL FROM range(200) t(i);
INSERT INTO eav
SELECT i, 3, NULL, i * 0.25, NULL, 'm', NULL FROM range(200) t(i);
INSERT INTO eav
SELECT i, 4, NULL, NULL, i % 2 = 0, NULL, NULL FROM range(200) t(i);
-- 25 numeric parameters per object: value = object_index * 100 + k (k = 1..25).
INSERT INTO eav
SELECT i, 8 + k, NULL, i * 100 + k + 1, NULL, NULL, 'PARAM_' || (k + 1)::VARCHAR
FROM range(200) o(i), range(25) p(k);

INSERT INTO types SELECT t, 'type-' || t::VARCHAR FROM range(5) r(t);
INSERT INTO type_eav
SELECT t, 5, 'Type ' || t::VARCHAR, NULL, NULL, NULL, NULL FROM range(5) r(t);
INSERT INTO type_eav
SELECT t, 6, 'FR' || (t * 30)::VARCHAR, NULL, NULL, NULL, NULL FROM range(5) r(t);
INSERT INTO type_eav
SELECT t, 7, NULL, (t + 1) * 100, NULL, 'mm', NULL FROM range(5) r(t);
INSERT INTO object_type SELECT i, i % 4 FROM range(199) t(i);

-- nodes(id, kind, name, def_ref, transform, units, subtype, argb, opacity, metalness,
--       roughness, emissive, ior, elevation)
INSERT INTO nodes
SELECT i, 5, 'Level ' || i::VARCHAR, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, i * 3.5
FROM range(3) t(i);
INSERT INTO nodes VALUES
  (3, 7, 'Model', NULL, NULL, NULL, 'Model', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (4, 1, 'Def A', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (5, 1, 'Def B', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO nodes
SELECT 6 + i, 2, NULL, 4 + (i % 2), '1,0,0,0,0,1,0,0,0,0,1,0,' || (i * 10)::VARCHAR || ',0,0,1', 'm',
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM range(4) t(i);
INSERT INTO nodes VALUES
  (10, 3, 'Concrete', NULL, NULL, NULL, NULL, -8355712, 1.0, 0.0, 0.8, NULL, NULL, NULL),
  (11, 4, NULL, NULL, NULL, NULL, NULL, -65536, 1.0, NULL, NULL, NULL, NULL, NULL);

-- relations(rel, src, dst, ord)
INSERT INTO relations SELECT 7, i, i % 3, NULL FROM range(200) t(i);          -- ON_LEVEL object→LEVEL
INSERT INTO relations SELECT 1, i, i % 10, 0 FROM range(200) t(i);            -- DISPLAY object→geometry
INSERT INTO relations SELECT 11, i, 3, NULL FROM range(200) t(i);             -- IN_MODEL object→CONTAINER
INSERT INTO relations SELECT 5, g, 10, NULL FROM range(5) t(g);               -- HAS_MATERIAL geometry→MATERIAL
INSERT INTO relations SELECT 8, i, 6 + i, 0 FROM range(4) t(i);               -- DISPLAY_INSTANCE object→INSTANCE
INSERT INTO relations SELECT 9, 4 + (i % 2), 6 + i, i FROM range(4) t(i);     -- DEFINES_INSTANCE DEFINITION→INSTANCE
INSERT INTO relations VALUES (6, 0, 11, NULL);                                -- HAS_COLOR object→COLOR

INSERT INTO geometries
SELECT g, ('SGEO' || repeat(chr((65 + g)::INTEGER), 16))::BLOB, 'geo-' || g::VARCHAR, 'Mesh'
FROM range(10) t(g);

INSERT INTO scene_views VALUES
  (0, 'By level', true, 0, 'rel', '7'),
  (1, 'By category', false, 1, 'eav', 'category');

INSERT INTO camera_views VALUES
  (0, 'Overview', true, 0, 10.0, -20.0, 15.0, -0.371, 0.743, -0.557, 0.0, 0.0, 1.0,
   0.0, 0.0, 0.0, 'm', false, 45.0, 35.0, NULL, 1.777, 0.1, 1000.0);

INSERT INTO structural_results VALUES
  (0, NULL, NULL, 'frameForce', 'Dead', 'P', NULL, 0.0, 1, -12.5, NULL),
  (0, NULL, NULL, 'frameForce', 'Dead', 'M3', NULL, 0.0, 1, 4.25, NULL),
  (NULL, 'P1', NULL, 'pierForce', 'EQx', 'V2', 'Top', NULL, 1, 8.0, NULL);
