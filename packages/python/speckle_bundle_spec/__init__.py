"""Speckle bundle spec — the generated Python vocabulary.

The modules beside this file are generated from ``spec/bundle-spec.sql`` in the
speckle-bundle-spec repository; this init is the hand-written public surface.
``SCHEMA_VERSION`` equals the package version.
"""

from speckle_bundle_spec.bundle_cols import (
    CAMERA_VIEWS,
    EAV,
    GEOMETRIES,
    MODEL,
    NODES,
    OBJECT_TYPE,
    OBJECTS,
    PATHS,
    PROPERTY_SET_DEFINITIONS,
    RELATIONS,
    REVIT_EXTERNAL_LINKS,
    REVIT_WARNINGS,
    SCENE_VIEWS,
    STRUCTURAL_RESULTS,
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
    PropertySetField,
    RevitExternalLink,
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
    "REVIT_WARNINGS",
    "SCENE_VIEWS",
    "SCHEMA_VERSION",
    "STRUCTURAL_RESULTS",
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
    "NodeKind",
    "NodeKindRow",
    "PropertySetField",
    "Rel",
    "RelTypeRow",
    "RevitExternalLink",
    "RevitWarning",
    "StructuralResult",
]
