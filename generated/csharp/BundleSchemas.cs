// GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT.
// Run `npm run generate` (or node codegen/generate-all.mjs) to refresh.
using System.Collections.Generic;

namespace Speckle.Bundle.Spec;

public enum ArrowType
{
    Int32,
    Int64,
    Utf8,
    Float64,
    Boolean,
    Binary,
}

public readonly record struct ColumnSpec(string Name, ArrowType Type);

public static class BundleSchemas
{
    public static readonly ColumnSpec[] Eav =
    {
        new("object_index", ArrowType.Int32),
        new("path_index", ArrowType.Int32),
        new("value_string", ArrowType.Utf8),
        new("value_double", ArrowType.Float64),
        new("value_boolean", ArrowType.Boolean),
        new("unit", ArrowType.Utf8),
        new("internal_definition_name", ArrowType.Utf8),
    };

    public static readonly ColumnSpec[] Geometries =
    {
        new("geometryIndex", ArrowType.Int32),
        new("content", ArrowType.Binary),
        new("id", ArrowType.Utf8),
        new("type", ArrowType.Utf8),
    };

    public static readonly ColumnSpec[] Nodes =
    {
        new("id", ArrowType.Int32),
        new("kind", ArrowType.Int32),
        new("name", ArrowType.Utf8),
        new("def_ref", ArrowType.Int32),
        new("transform", ArrowType.Utf8),
        new("units", ArrowType.Utf8),
        new("subtype", ArrowType.Utf8),
        new("argb", ArrowType.Int32),
        new("opacity", ArrowType.Float64),
        new("metalness", ArrowType.Float64),
        new("roughness", ArrowType.Float64),
        new("elevation", ArrowType.Float64),
    };

    public static readonly ColumnSpec[] ObjectType =
    {
        new("object_index", ArrowType.Int32),
        new("type_index", ArrowType.Int32),
    };

    public static readonly ColumnSpec[] Objects =
    {
        new("object_index", ArrowType.Int32),
        new("application_id", ArrowType.Utf8),
    };

    public static readonly ColumnSpec[] Paths =
    {
        new("path_index", ArrowType.Int32),
        new("path", ArrowType.Utf8),
    };

    public static readonly ColumnSpec[] Relations =
    {
        new("rel", ArrowType.Int32),
        new("src", ArrowType.Int32),
        new("dst", ArrowType.Int32),
        new("ord", ArrowType.Int32),
    };

    public static readonly ColumnSpec[] SceneViews =
    {
        new("view", ArrowType.Int32),
        new("name", ArrowType.Utf8),
        new("is_default", ArrowType.Boolean),
        new("ord", ArrowType.Int32),
        new("source", ArrowType.Utf8),
        new("ref", ArrowType.Utf8),
    };

    public static readonly ColumnSpec[] TypeEav =
    {
        new("type_index", ArrowType.Int32),
        new("path_index", ArrowType.Int32),
        new("value_string", ArrowType.Utf8),
        new("value_double", ArrowType.Float64),
        new("value_boolean", ArrowType.Boolean),
        new("unit", ArrowType.Utf8),
        new("internal_definition_name", ArrowType.Utf8),
    };

    public static readonly ColumnSpec[] Types =
    {
        new("type_index", ArrowType.Int32),
        new("type_key", ArrowType.Utf8),
    };

    public static readonly IReadOnlyDictionary<string, ColumnSpec[]> ByTable =
        new Dictionary<string, ColumnSpec[]>
        {
        ["eav"] = Eav,
        ["geometries"] = Geometries,
        ["nodes"] = Nodes,
        ["object_type"] = ObjectType,
        ["objects"] = Objects,
        ["paths"] = Paths,
        ["relations"] = Relations,
        ["scene_views"] = SceneViews,
        ["type_eav"] = TypeEav,
        ["types"] = Types,
        };
}
