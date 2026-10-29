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

// One revit_warnings row, in column order.
struct RevitWarning {
  int32_t warning_index;
  std::string warning_class;
  std::optional<int32_t> warning_type;
  std::string warning_kind;
  std::optional<std::string> failure_definition_id;
  std::string description;
  std::optional<std::string> element_id;
  std::optional<std::string> element_application_id;
  std::optional<std::string> element_category;
};

// One revit_external_links row, in column order.
struct RevitExternalLink {
  std::string kind;
  std::string element_id;
  std::optional<std::string> name;
  bool view_specific;
  std::optional<bool> is_included;
  std::optional<std::string> workset;
  std::optional<std::string> transform;
};

// One revit_views row, in column order.
struct RevitView {
  std::string element_id;
  std::optional<std::string> name;
  std::string view_type;
  bool is_template;
  std::optional<std::string> view_template_id;
  std::optional<std::string> sheet_number;
  std::optional<int32_t> sheet_placements;
  std::optional<std::string> orientation;
};

// One material_textures row, in column order.
struct MaterialTexture {
  int32_t material;
  std::string role;
  int32_t ord;
  std::string status;
  std::optional<int32_t> texture;
  std::optional<std::string> uv_transform;
  std::optional<std::string> uri;
  std::optional<std::string> saved_location;
  std::optional<std::string> property;
};

}  // namespace bundlespec
