// GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT.
// Run `npm run generate` (or node codegen/generate-all.mjs) to refresh.

/** Shared geometry template. */
export interface Definition {
  name: string | null
  defRef: number | null
}

/** A placement / occurrence. */
export interface Instance {
  transform: string
  units: string | null
  defRef: number
}

/** Full-PBR render asset. */
export interface Material {
  name: string | null
  argb: number
  opacity: number
  metalness: number
  roughness: number
  emissive: number | null
  ior: number | null
}

/** Raw colour override. */
export interface Color {
  argb: number
}

/** A storey. */
export interface Level {
  name: string | null
  elevation: number
}

/** Polymorphic grouping tree. */
export interface Container {
  name: string | null
  defRef: number | null
  subtype: string | null
  ghTopology: string | null
}
