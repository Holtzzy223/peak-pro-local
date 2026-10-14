const STORAGE_KEY = 'peak-local:vapor-path'
const OFF = 'off'

/** The per-profile "intensity" field, a float32 like the other heat-profile fields; %N is the slot index. */
export const DEFAULT_VAPOR_PATH = '/u/app/hc/%N/intn'

/** Paths that might hold the per-profile vapor setting; only intn answers on Peak Pro firmware AW. */
export const VAPOR_PATH_CANDIDATES = [
  '/u/app/hc/%N/vapr',
  '/u/app/hc/%N/vpr',
  '/u/app/hc/%N/vctl',
  '/u/app/hc/%N/vapc',
  DEFAULT_VAPOR_PATH,
  '/u/app/hc/%N/vlvl',
  '/u/app/hc/%N/mode',
]

export const VAPOR_LEVELS = [
  { value: 0, label: 'Smooth' },
  { value: 1, label: 'Regular' },
  { value: 2, label: 'Strong' },
  { value: 3, label: 'XL', xlOnly: true },
]

export function vaporLabel(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return VAPOR_LEVELS.find((l) => l.value === value)?.label ?? null
}

export function slotPath(template: string, slot: number): string {
  return template.replace('%N', String(slot))
}

export function getVaporPath(): string | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === OFF) return null
  return stored ?? DEFAULT_VAPOR_PATH
}

export function setVaporPath(template: string | null) {
  localStorage.setItem(STORAGE_KEY, template ?? OFF)
}
