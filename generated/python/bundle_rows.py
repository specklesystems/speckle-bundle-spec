# GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT.
# Run `npm run generate` (or node codegen/generate-all.mjs) to refresh.
"""One record per row-shaped table, carrying its columns in DDL order.

Single source of truth: speckle-bundle-spec/spec/bundle-spec.sql.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class StructuralResult:
    """One structural_results row, in column order."""

    object_index: Optional[int]
    element_name: Optional[str]
    location: Optional[str]
    result_type: str
    load_case: str
    component: str
    position_label: Optional[str] = None
    station: Optional[float] = None
    step: Optional[int] = None
    value: Optional[float] = None
    value_text: Optional[str] = None


@dataclass(frozen=True)
class PropertySetField:
    """One property_set_definitions row, in column order."""

    set_name: str
    set_key: str
    set_description: Optional[str]
    field_name: str
    field_bucket_id: Optional[str] = None
    data_type: Optional[str] = None
    default_string: Optional[str] = None
    default_double: Optional[float] = None
    default_boolean: Optional[bool] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    applies_to: Optional[str] = None


@dataclass(frozen=True)
class CameraView:
    """One camera_views row, in column order."""

    view: int
    name: Optional[str]
    is_default: bool
    ord: Optional[int]
    pos_x: float
    pos_y: float
    pos_z: float
    forward_x: float
    forward_y: float
    forward_z: float
    up_x: float
    up_y: float
    up_z: float
    target_x: Optional[float]
    target_y: Optional[float]
    target_z: Optional[float]
    units: Optional[str]
    is_ortho: bool
    fov: Optional[float] = None
    lens_mm: Optional[float] = None
    ortho_height: Optional[float] = None
    aspect: Optional[float] = None
    near: Optional[float] = None
    far: Optional[float] = None
