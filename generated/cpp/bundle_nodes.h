// GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT.
// Run `npm run generate` (or node codegen/generate-all.mjs) to refresh.
#pragma once
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace bundlespec {

// Shared geometry template.
struct Definition {
  std::optional<std::string> name;
  std::optional<int32_t> def_ref;
};

// A placement / occurrence.
struct Instance {
  std::string transform;
  std::optional<std::string> units;
  int32_t def_ref;
};

// Full-PBR render asset.
struct Material {
  std::optional<std::string> name;
  int32_t argb;
  double opacity;
  double metalness;
  double roughness;
  std::optional<int32_t> emissive;
  std::optional<double> ior;
};

// Raw colour override.
struct Color {
  int32_t argb;
};

// A storey.
struct Level {
  std::optional<std::string> name;
  double elevation;
};

// Polymorphic grouping tree.
struct Container {
  std::optional<std::string> name;
  std::optional<int32_t> def_ref;
  std::string subtype;
  std::optional<std::string> gh_topology;
};

}  // namespace bundlespec
