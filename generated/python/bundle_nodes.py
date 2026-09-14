# GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT.
# Run `npm run generate` (or node codegen/generate-all.mjs) to refresh.
"""One record per live node kind, carrying exactly the nodes.* columns it declares.

Single source of truth: speckle-bundle-spec/spec/bundle-spec.sql (node_kinds.columns).
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Definition:
    """Shared geometry template."""

    name: Optional[str] = None
    def_ref: Optional[int] = None


@dataclass(frozen=True)
class Instance:
    """A placement / occurrence."""

    transform: str
    def_ref: int
    units: Optional[str] = None


@dataclass(frozen=True)
class Material:
    """Full-PBR render asset."""

    argb: int
    opacity: float
    metalness: float
    roughness: float
    name: Optional[str] = None
    emissive: Optional[int] = None
    ior: Optional[float] = None


@dataclass(frozen=True)
class Color:
    """Raw colour override."""

    argb: int


@dataclass(frozen=True)
class Level:
    """A storey."""

    elevation: float
    name: Optional[str] = None


@dataclass(frozen=True)
class Container:
    """Polymorphic grouping tree."""

    subtype: str
    name: Optional[str] = None
    def_ref: Optional[int] = None
    gh_topology: Optional[str] = None
