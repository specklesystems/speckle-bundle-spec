"""Speckle bundle spec — the generated Python vocabulary.

The modules beside this file are generated from ``spec/bundle-spec.sql`` in the
speckle-bundle-spec repository; this init is the hand-written public surface.
``SCHEMA_VERSION`` equals the package version.
"""

from speckle_bundle_spec.bundle_cols import (
    CAMERA_VIEWS,
    EAV,
    GEOMETRIES,
    MATERIAL_TEXTURES,
    MODEL,
    NODES,
    OBJECT_TYPE,
    OBJECTS,
    PATHS,
    PROPERTY_SET_DEFINITIONS,
    RELATIONS,
    REVIT_EXTERNAL_LINKS,
    REVIT_VIEWS,
    REVIT_WARNINGS,
    SCENE_VIEWS,
    STRUCTURAL_RESULTS,
    TEXTURES,
    TYPE_EAV,
    TYPES,
)
from speckle_bundle_spec.bundle_nodes import (
    Color,
    Container,
    Definition,
    Instance,
    Level,
    Material,
)
from speckle_bundle_spec.bundle_rows import (
    CameraView,
    MaterialTexture,
    PropertySetField,
    RevitExternalLink,
    RevitView,
    RevitWarning,
    StructuralResult,
)
from speckle_bundle_spec.bundle_schemas import BY_TABLE, ColumnSpec
from speckle_bundle_spec.bundle_spec import (
    NODE_KINDS,
    REL_TYPES,
    SCHEMA_VERSION,
    NodeKind,
    NodeKindRow,
    Rel,
    RelTypeRow,
)

__all__ = [
    "BY_TABLE",
    "CAMERA_VIEWS",
    "EAV",
    "GEOMETRIES",
    "MATERIAL_TEXTURES",
    "MODEL",
    "NODES",
    "NODE_KINDS",
    "OBJECTS",
    "OBJECT_TYPE",
    "PATHS",
    "PROPERTY_SET_DEFINITIONS",
    "RELATIONS",
    "REL_TYPES",
    "REVIT_EXTERNAL_LINKS",
    "REVIT_VIEWS",
    "REVIT_WARNINGS",
    "SCENE_VIEWS",
    "SCHEMA_VERSION",
    "STRUCTURAL_RESULTS",
    "TEXTURES",
    "TYPES",
    "TYPE_EAV",
    "CameraView",
    "Color",
    "ColumnSpec",
    "Container",
    "Definition",
    "Instance",
    "Level",
    "Material",
    "MaterialTexture",
    "NodeKind",
    "NodeKindRow",
    "PropertySetField",
    "Rel",
    "RelTypeRow",
    "RevitExternalLink",
    "RevitView",
    "RevitWarning",
    "StructuralResult",
]
