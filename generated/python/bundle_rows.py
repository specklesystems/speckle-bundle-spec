# GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT.
# Run `npm run generate` (or node codegen/generate-all.mjs) to refresh.
"""One record per row-shaped table, carrying its columns in DDL order.

Single source of truth: speckle-bundle-spec/spec/bundle-spec.sql.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class StructuralResult:
    """One structural_results row, in column order."""

    object_index: int | None
    element_name: str | None
    location: str | None
    result_type: str
    load_case: str
    component: str
    position_label: str | None = None
    station: float | None = None
    step: int | None = None
    value: float | None = None
    value_text: str | None = None


@dataclass(frozen=True)
class PropertySetField:
    """One property_set_definitions row, in column order."""

    set_name: str
    set_key: str
    set_description: str | None
    field_name: str
    field_bucket_id: str | None = None
    data_type: str | None = None
    default_string: str | None = None
    default_double: float | None = None
    default_boolean: bool | None = None
    unit: str | None = None
    description: str | None = None
    applies_to: str | None = None


@dataclass(frozen=True)
class CameraView:
    """One camera_views row, in column order."""

    view: int
    name: str | None
    is_default: bool
    ord: int | None
    pos_x: float
    pos_y: float
    pos_z: float
    forward_x: float
    forward_y: float
    forward_z: float
    up_x: float
    up_y: float
    up_z: float
    target_x: float | None
    target_y: float | None
    target_z: float | None
    units: str | None
    is_ortho: bool
    fov: float | None = None
    lens_mm: float | None = None
    ortho_height: float | None = None
    aspect: float | None = None
    near: float | None = None
    far: float | None = None


@dataclass(frozen=True)
class RevitWarning:
    """One revit_warnings row, in column order."""

    warning_index: int
    warning_class: str
    warning_type: int | None
    failure_definition_id: str | None
    description: str
    element_id: str | None = None
    element_application_id: str | None = None
    element_category: str | None = None


@dataclass(frozen=True)
class RevitExternalLink:
    """One revit_external_links row, in column order."""

    kind: str
    element_id: str
    name: str | None
    view_specific: bool
