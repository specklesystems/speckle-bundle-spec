// GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT.
// Run `npm run generate` (or node codegen/generate-all.mjs) to refresh.
#pragma once
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace bundlespec {

// One structural_results row, in column order.
struct StructuralResult {
  std::optional<int32_t> object_index;
  std::optional<std::string> element_name;
  std::optional<std::string> location;
  std::string result_type;
  std::string load_case;
  std::string component;
  std::optional<std::string> position_label;
  std::optional<double> station;
  std::optional<int32_t> step;
  std::optional<double> value;
  std::optional<std::string> value_text;
};

// One property_set_definitions row, in column order.
struct PropertySetField {
  std::string set_name;
  std::string set_key;
  std::optional<std::string> set_description;
  std::string field_name;
  std::optional<std::string> field_bucket_id;
  std::optional<std::string> data_type;
  std::optional<std::string> default_string;
  std::optional<double> default_double;
  std::optional<bool> default_boolean;
  std::optional<std::string> unit;
  std::optional<std::string> description;
  std::optional<std::string> applies_to;
};

// One camera_views row, in column order.
struct CameraView {
  int32_t view;
  std::optional<std::string> name;
  bool is_default;
  std::optional<int32_t> ord;
  double pos_x;
  double pos_y;
  double pos_z;
  double forward_x;
  double forward_y;
  double forward_z;
  double up_x;
  double up_y;
  double up_z;
  std::optional<double> target_x;
  std::optional<double> target_y;
  std::optional<double> target_z;
  std::optional<std::string> units;
  bool is_ortho;
  std::optional<double> fov;
  std::optional<double> lens_mm;
  std::optional<double> ortho_height;
  std::optional<double> aspect;
  std::optional<double> near;
  std::optional<double> far;
};

}  // namespace bundlespec
