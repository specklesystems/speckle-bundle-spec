// GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT.
// Run `npm run generate` (or node codegen/generate-all.mjs) to refresh.

/** Shared geometry template. */
export type Definition = {
  name: string | null
  defRef: number | null
}

/** A placement / occurrence. */
export type Instance = {
  transform: string
  units: string | null
  defRef: number
}

/** Full-PBR render asset. */
export type Material = {
  name: string | null
  argb: number
  opacity: number
  metalness: number
  roughness: number
  emissive: number | null
  ior: number | null
}

/** Raw colour override. */
export type Color = {
  argb: number
}

/** A storey. */
export type Level = {
  name: string | null
  elevation: number
}

/** Polymorphic grouping tree. */
export type Container = {
  name: string | null
  defRef: number | null
  subtype: string
  ghTopology: string | null
}
