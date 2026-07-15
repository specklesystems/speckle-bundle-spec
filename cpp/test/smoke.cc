// Smoke test for the shared bundle C++ package: exercises the writer end-to-end
// (BundleWriter + envelope catalog + scene views), reads the result back with
// BundleReader, and unit-checks the pure-core codecs (SGEO round-trip, CRC/SHA
// known-answer vectors, units table, numToR formatting). Exit 0 = pass.
#include "bundle_reader.h"
#include "bundle_writer.h"
#include "envelope_catalog.h"
#include "eav_flatten.h"
#include "sgeo.h"
#include "units.h"

#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>

static int failures = 0;
#define CHECK(cond)                                                    \
  do {                                                                 \
    if (!(cond)) {                                                     \
      std::fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond); \
      ++failures;                                                      \
    }                                                                  \
  } while (0)

int main() {
  namespace fs = std::filesystem;

  // ── core: CRC32 / SHA-256 known-answer vectors ──
  CHECK(sgeo::crc32(reinterpret_cast<const uint8_t*>("123456789"), 9) ==
        0xCBF43926u);
  CHECK(sgeo::sha256hex(std::string("abc")) ==
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

  // ── core: units table ──
  CHECK(units::code("mm") == 1 && units::code("mi") == 8 &&
        units::code("bogus") == 0);
  CHECK(units::fromCode(3) == "m" && units::fromCode(999) == "none");
  CHECK(units::toMeters("ft") == 0.3048 && units::toMeters("") == 1.0);
  CHECK(sgeo::unitsCode("cm") == 2);  // delegate stays alive

  // ── core: numToR (.NET "R" formatting) ──
  CHECK(eav::numToR(1e16) == "1E+16");
  CHECK(eav::numToR(0.0001) == "0.0001");
  CHECK(eav::numToR(-2.5) == "-2.5");
  CHECK(eav::numToR(0.00005) == "5E-05");

  // ── core: SGEO round-trip, with + without colors ──
  const std::vector<double> verts = {0, 0, 0, 1, 0, 0, 0, 1, 0};
  const std::vector<int32_t> faces = {3, 0, 1, 2};
  const std::vector<int32_t> colors = {(int32_t)0xFFFF0000, (int32_t)0xFF00FF00,
                                       (int32_t)0xFF0000FF};
  auto plain = sgeo::encodeMesh(verts, faces, units::code("m"));
  auto colored = sgeo::encodeMesh(verts, faces, units::code("m"), colors);
  CHECK(plain[6] == 0);                       // flags=0 without colors
  CHECK(colored[6] == sgeo::FLAG_HAS_COLORS); // colors flag set
  CHECK(colored.size() == plain.size() + colors.size() * 4);
  sgeo::DecodedMesh dm;
  CHECK(sgeo::decodeMesh(plain.data(), plain.size(), dm));
  CHECK(dm.vertices == verts && dm.faces == faces && dm.units == "m");
  sgeo::DecodedMesh dmc;
  CHECK(sgeo::decodeMesh(colored.data(), colored.size(), dmc));
  CHECK(dmc.vertices == verts && dmc.faces == faces);

  // ── core: eav flatten (defaults vs producer-shaped options) ──
  auto mkDict = [] { return std::make_shared<PDict>(); };
  auto props = mkDict();
  auto group = mkDict();
  group->set("Height", PVal::Dbl(2.5));
  props->set("General", PVal::Map(group));
  auto userGroup = mkDict();
  userGroup->set("Area", PVal::Str("12"));
  props->set("Material Quantities", PVal::Map(userGroup));
  std::vector<EavRow> rowsDefault, rowsOpen;
  eav::flatten(*props, {}, nullptr, rowsDefault);
  eav::WalkOptions open;
  open.skipTypeParamsStructure = false;
  open.materialQuantitiesSpecialCase = false;
  eav::flatten(*props, {}, nullptr, rowsOpen, open);
  CHECK(rowsDefault.size() == 1);  // MQ swallowed by the Revit special-case shape
  CHECK(rowsOpen.size() == 2);     // archicad shape keeps the user group
  CHECK(rowsOpen[0].path == "properties.General.Height" &&
        rowsOpen[0].valueText == "2.5");

  // ── writer → reader round-trip ──
  fs::path dir = fs::temp_directory_path() / "speckle-bundle-smoke";
  fs::remove_all(dir);
  fs::create_directories(dir);
  const std::string base = "smoke";
  {
    BundleWriter w(dir.string(), base, /*geomShardCap=*/1536LL * 1024 * 1024);
    CHECK(w.ok());
    int objK = w.internObject("app-1");
    CHECK(w.internObject("app-1") == objK);  // interned
    w.writeInstanceEav(objK, rowsOpen);

    auto blob = sgeo::encodeMesh(verts, faces, units::code("m"), colors);
    std::string gid = sgeo::sha256hex(blob.data(), blob.size());
    int geomK = w.addGeometry(gid, blob.data(), (int64_t)blob.size());
    w.addRel((int)bundlespec::Rel::DISPLAY, objK, geomK, 0);

    std::string matName = "Brick";
    int matK = w.addNode(bundlespec::NodeKind::MATERIAL, &matName, -1, nullptr,
                         nullptr, nullptr, true, (int)0xFFAA8866, 1.0,
                         /*roughness=*/0.25);
    w.addRel((int)bundlespec::Rel::HAS_MATERIAL, geomK, matK, 0);
    std::string lvlName = "Level 1";
    int lvlK = w.addLevelNode(&lvlName, 3.0);
    w.addRel((int)bundlespec::Rel::ON_LEVEL, objK, lvlK, 0);
    w.finalize();
    CHECK(w.ok());
  }
  envcat::writeCatalogTables(dir.string(), base, "smoke-test");
  envcat::writeSceneViewTiers(dir.string(), base,
                              {{"rel", "7"}, {"eav", "type"}});

  {
    auto r = speckle::BundleReader::open(dir, base);
    int objects = 0;
    r.forEachObject([&](const speckle::BundleReader::ObjectRow& o) {
      ++objects;
      CHECK(o.applicationId == "app-1");
    });
    CHECK(objects == 1);

    auto rels = r.readRelations({(int)bundlespec::Rel::DISPLAY,
                                 (int)bundlespec::Rel::HAS_MATERIAL});
    CHECK(rels.size() == 2);  // ON_LEVEL filtered out
    for (size_t i = 1; i < rels.size(); ++i)
      CHECK(rels[i - 1].src <= rels[i].src);

    int mats = 0, levels = 0;
    r.forEachNode(
        [&](const speckle::BundleReader::NodeRow& n) {
          if (n.kind == (int)bundlespec::NodeKind::MATERIAL) {
            ++mats;
            CHECK(n.name && *n.name == "Brick");
            CHECK(n.roughness && *n.roughness == 0.25);
            CHECK(n.metalness && *n.metalness == 0.0);
          }
          if (n.kind == (int)bundlespec::NodeKind::LEVEL) {
            ++levels;
            CHECK(n.elevation && *n.elevation == 3.0);
          }
        },
        {(int)bundlespec::NodeKind::MATERIAL,
         (int)bundlespec::NodeKind::LEVEL});
    CHECK(mats == 1 && levels == 1);

    int geoms = 0;
    r.forEachGeometry([&](const speckle::BundleReader::GeometryRow& g) {
      ++geoms;
      CHECK(g.type == "mesh");
      sgeo::DecodedMesh m;
      CHECK(sgeo::decodeMesh(g.content, (size_t)g.contentLength, m));
      CHECK(m.vertices == verts && m.faces == faces);
      CHECK(g.id == sgeo::sha256hex(g.content, (size_t)g.contentLength));
    });
    CHECK(geoms == 1);
  }

  // suffix predicates (the receive path's isNeeded contract)
  CHECK(speckle::BundleReader::isReceiveTable("x.eav.objects.parquet"));
  CHECK(speckle::BundleReader::isReceiveTable("x.geometries.2.parquet"));
  CHECK(!speckle::BundleReader::isReceiveTable("x.eav.paths.parquet"));

  fs::remove_all(dir);
  if (failures == 0) std::puts("smoke: all checks passed");
  return failures == 0 ? 0 : 1;
}
