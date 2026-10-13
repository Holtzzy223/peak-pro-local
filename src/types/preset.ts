export type ProfileSlot = 0 | 1 | 2 | 3

export type LampParam = {
  color?: string[]
  colorLen?: number
  [key: string]: unknown
}

export type LampColorSchema = {
  lamp: {
    name: string
    param: LampParam
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type ProfileDraft = {
  name: string
  tempF: number
  timeS: number
  boostTempF: number
  boostTimeS: number
  vapor: number | null
  color: LampColorSchema
}

export type SavedPreset = {
  id: string
  name: string
  tempF: number
  timeS: number
  boostTempF: number
  boostTimeS: number
  vapor?: number | null
  color: LampColorSchema
  favorite?: boolean
  createdAt: string
  notes?: string
}

export const TEMP_F_MIN = 200
export const TEMP_F_MAX = 620
export const TIME_S_MIN = 10
export const TIME_S_MAX = 180
export const BOOST_TEMP_F_MIN = 0
export const BOOST_TEMP_F_MAX = 50
export const BOOST_TIME_S_MIN = 0
export const BOOST_TIME_S_MAX = 60
export const DEFAULT_BOOST_TEMP_F = 10
export const DEFAULT_BOOST_TIME_S = 15

export function emptyProfile(name: string): ProfileDraft {
  return {
    name,
    tempF: 450,
    timeS: 40,
    boostTempF: DEFAULT_BOOST_TEMP_F,
    boostTimeS: DEFAULT_BOOST_TIME_S,
    vapor: null,
    color: defaultSolidColor('#4488ff'),
  }
}

export function defaultSolidColor(hex: string): LampColorSchema {
  return {
    lamp: {
      name: 'solid',
      param: { color: [hex], colorLen: 1 },
    },
  }
}

export function draftToPreset(draft: ProfileDraft, notes?: string): SavedPreset {
  return {
    id: crypto.randomUUID(),
    name: draft.name.trim() || 'Untitled',
    tempF: draft.tempF,
    timeS: draft.timeS,
    boostTempF: draft.boostTempF,
    boostTimeS: draft.boostTimeS,
    vapor: draft.vapor,
    color: structuredClone(draft.color),
    createdAt: new Date().toISOString(),
    notes,
  }
}

export function presetToDraft(preset: SavedPreset): ProfileDraft {
  return {
    name: preset.name,
    tempF: preset.tempF,
    timeS: preset.timeS,
    boostTempF: preset.boostTempF ?? DEFAULT_BOOST_TEMP_F,
    boostTimeS: preset.boostTimeS ?? DEFAULT_BOOST_TIME_S,
    vapor: preset.vapor ?? null,
    color: structuredClone(preset.color),
  }
}
