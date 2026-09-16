// GENERATED FROM spec/bundle-spec.sql — DO NOT EDIT.
// Run `npm run generate` (or node codegen/generate-all.mjs) to refresh.

/** One `structural_results` row, in column order. */
export type StructuralResult = {
  objectIndex: number | null
  elementName: string | null
  location: string | null
  resultType: string
  loadCase: string
  component: string
  positionLabel: string | null
  station: number | null
  step: number | null
  value: number | null
  valueText: string | null
}

/** One `property_set_definitions` row, in column order. */
export type PropertySetField = {
  setName: string
  setKey: string
  setDescription: string | null
  fieldName: string
  fieldBucketId: string | null
  dataType: string | null
  defaultString: string | null
  defaultDouble: number | null
  defaultBoolean: boolean | null
  unit: string | null
  description: string | null
  appliesTo: string | null
}

/** One `camera_views` row, in column order. */
export type CameraView = {
  view: number
  name: string | null
  isDefault: boolean
  ord: number | null
  posX: number
  posY: number
  posZ: number
  forwardX: number
  forwardY: number
  forwardZ: number
  upX: number
  upY: number
  upZ: number
  targetX: number | null
  targetY: number | null
  targetZ: number | null
  units: string | null
  isOrtho: boolean
  fov: number | null
  lensMm: number | null
  orthoHeight: number | null
  aspect: number | null
  near: number | null
  far: number | null
}
