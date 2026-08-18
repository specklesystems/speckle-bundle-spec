// GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT.
// Run `npm run generate` (or node codegen/generate-all.mjs) to refresh.
#pragma once
#include <arrow/api.h>
#include <memory>

// Field nullability is left at Arrow's default (nullable); the spec's NOT NULL
// markers are validation intent, not parquet constraints.
namespace bundlespec {

// camera_views
inline std::shared_ptr<arrow::Schema> cameraViewsSchema() {
  return arrow::schema({
      arrow::field("view", arrow::int32()),
      arrow::field("name", arrow::utf8()),
      arrow::field("is_default", arrow::boolean()),
      arrow::field("ord", arrow::int32()),
      arrow::field("pos_x", arrow::float64()),
      arrow::field("pos_y", arrow::float64()),
      arrow::field("pos_z", arrow::float64()),
      arrow::field("forward_x", arrow::float64()),
      arrow::field("forward_y", arrow::float64()),
      arrow::field("forward_z", arrow::float64()),
      arrow::field("up_x", arrow::float64()),
      arrow::field("up_y", arrow::float64()),
      arrow::field("up_z", arrow::float64()),
      arrow::field("target_x", arrow::float64()),
      arrow::field("target_y", arrow::float64()),
      arrow::field("target_z", arrow::float64()),
      arrow::field("units", arrow::utf8()),
      arrow::field("is_ortho", arrow::boolean()),
      arrow::field("fov", arrow::float64()),
      arrow::field("lens_mm", arrow::float64()),
      arrow::field("ortho_height", arrow::float64()),
      arrow::field("aspect", arrow::float64()),
      arrow::field("near", arrow::float64()),
      arrow::field("far", arrow::float64())
  });
}

// eav
inline std::shared_ptr<arrow::Schema> eavSchema() {
  return arrow::schema({
      arrow::field("object_index", arrow::int32()),
      arrow::field("path_index", arrow::int32()),
      arrow::field("value_string", arrow::utf8()),
      arrow::field("value_double", arrow::float64()),
      arrow::field("value_boolean", arrow::boolean()),
      arrow::field("unit", arrow::utf8()),
      arrow::field("internal_definition_name", arrow::utf8())
  });
}

// geometries
inline std::shared_ptr<arrow::Schema> geometriesSchema() {
  return arrow::schema({
      arrow::field("geometryIndex", arrow::int32()),
      arrow::field("content", arrow::binary()),
      arrow::field("id", arrow::utf8()),
      arrow::field("type", arrow::utf8())
  });
}

// model
inline std::shared_ptr<arrow::Schema> modelSchema() {
  return arrow::schema({
      arrow::field("path", arrow::utf8()),
      arrow::field("value_string", arrow::utf8()),
      arrow::field("value_double", arrow::float64()),
      arrow::field("value_boolean", arrow::boolean()),
      arrow::field("unit", arrow::utf8())
  });
}

// nodes
inline std::shared_ptr<arrow::Schema> nodesSchema() {
  return arrow::schema({
      arrow::field("id", arrow::int32()),
      arrow::field("kind", arrow::int32()),
      arrow::field("name", arrow::utf8()),
      arrow::field("def_ref", arrow::int32()),
      arrow::field("transform", arrow::utf8()),
      arrow::field("units", arrow::utf8()),
      arrow::field("subtype", arrow::utf8()),
      arrow::field("argb", arrow::int32()),
      arrow::field("opacity", arrow::float64()),
      arrow::field("metalness", arrow::float64()),
      arrow::field("roughness", arrow::float64()),
      arrow::field("emissive", arrow::int32()),
      arrow::field("ior", arrow::float64()),
      arrow::field("elevation", arrow::float64()),
      arrow::field("gh_topology", arrow::utf8())
  });
}

// object_type
inline std::shared_ptr<arrow::Schema> objectTypeSchema() {
  return arrow::schema({
      arrow::field("object_index", arrow::int32()),
      arrow::field("type_index", arrow::int32())
  });
}

// objects
inline std::shared_ptr<arrow::Schema> objectsSchema() {
  return arrow::schema({
      arrow::field("object_index", arrow::int32()),
      arrow::field("application_id", arrow::utf8())
  });
}

// paths
inline std::shared_ptr<arrow::Schema> pathsSchema() {
  return arrow::schema({
      arrow::field("path_index", arrow::int32()),
      arrow::field("path", arrow::utf8())
  });
}

// property_set_definitions
inline std::shared_ptr<arrow::Schema> propertySetDefinitionsSchema() {
  return arrow::schema({
      arrow::field("set_name", arrow::utf8()),
      arrow::field("set_key", arrow::utf8()),
      arrow::field("set_description", arrow::utf8()),
      arrow::field("field_name", arrow::utf8()),
      arrow::field("field_bucket_id", arrow::utf8()),
      arrow::field("data_type", arrow::utf8()),
      arrow::field("default_string", arrow::utf8()),
      arrow::field("default_double", arrow::float64()),
      arrow::field("default_boolean", arrow::boolean()),
      arrow::field("unit", arrow::utf8()),
      arrow::field("description", arrow::utf8()),
      arrow::field("applies_to", arrow::utf8())
  });
}

// relations
inline std::shared_ptr<arrow::Schema> relationsSchema() {
  return arrow::schema({
      arrow::field("rel", arrow::int32()),
      arrow::field("src", arrow::int32()),
      arrow::field("dst", arrow::int32()),
      arrow::field("ord", arrow::int32())
  });
}

// scene_views
inline std::shared_ptr<arrow::Schema> sceneViewsSchema() {
  return arrow::schema({
      arrow::field("view", arrow::int32()),
      arrow::field("name", arrow::utf8()),
      arrow::field("is_default", arrow::boolean()),
      arrow::field("ord", arrow::int32()),
      arrow::field("source", arrow::utf8()),
      arrow::field("ref", arrow::utf8())
  });
}

// sgeo_flags
inline std::shared_ptr<arrow::Schema> sgeoFlagsSchema() {
  return arrow::schema({
      arrow::field("bit", arrow::int32()),
      arrow::field("name", arrow::utf8()),
      arrow::field("applies_to", arrow::utf8()),
      arrow::field("status", arrow::utf8()),
      arrow::field("description", arrow::utf8()),
      arrow::field("why", arrow::utf8())
  });
}

// sgeo_primitive_types
inline std::shared_ptr<arrow::Schema> sgeoPrimitiveTypesSchema() {
  return arrow::schema({
      arrow::field("id", arrow::int32()),
      arrow::field("name", arrow::utf8()),
      arrow::field("status", arrow::utf8()),
      arrow::field("description", arrow::utf8())
  });
}

// structural_results
inline std::shared_ptr<arrow::Schema> structuralResultsSchema() {
  return arrow::schema({
      arrow::field("object_index", arrow::int32()),
      arrow::field("element_name", arrow::utf8()),
      arrow::field("location", arrow::utf8()),
      arrow::field("result_type", arrow::utf8()),
      arrow::field("load_case", arrow::utf8()),
      arrow::field("component", arrow::utf8()),
      arrow::field("position_label", arrow::utf8()),
      arrow::field("station", arrow::float64()),
      arrow::field("step", arrow::int32()),
      arrow::field("value", arrow::float64()),
      arrow::field("value_text", arrow::utf8())
  });
}

// type_eav
inline std::shared_ptr<arrow::Schema> typeEavSchema() {
  return arrow::schema({
      arrow::field("type_index", arrow::int32()),
      arrow::field("path_index", arrow::int32()),
      arrow::field("value_string", arrow::utf8()),
      arrow::field("value_double", arrow::float64()),
      arrow::field("value_boolean", arrow::boolean()),
      arrow::field("unit", arrow::utf8()),
      arrow::field("internal_definition_name", arrow::utf8())
  });
}

// types
inline std::shared_ptr<arrow::Schema> typesSchema() {
  return arrow::schema({
      arrow::field("type_index", arrow::int32()),
      arrow::field("type_key", arrow::utf8())
  });
}

}  // namespace bundlespec
