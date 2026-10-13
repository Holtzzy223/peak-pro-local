const STORAGE_KEY = 'peak-local:vapor-path'

/** Paths that might hold the per-profile vapor setting; %N is the slot index. None are confirmed. */
export const VAPOR_PATH_CANDIDATES = [
  '/u/app/hc/%N/vapr',
  '/u/app/hc/%N/vpr',
  '/u/app/hc/%N/vctl',
  '/u/app/hc/%N/vapc',
  '/u/app/hc/%N/intn',
  '/u/app/hc/%N/vlvl',
  '/u/app/hc/%N/mode',
]

export const VAPOR_LEVELS = [
  { value: 0, label: 'Standard' },
  { value: 1, label: 'High' },
  { value: 2, label: 'Max' },
  { value: 3, label: 'XL', xlOnly: true },
]

export function slotPath(template: string, slot: number): string {
  return template.replace('%N', String(slot))
}

export function getVaporPath(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setVaporPath(template: string | null) {
  if (template) localStorage.setItem(STORAGE_KEY, template)
  else localStorage.removeItem(STORAGE_KEY)
}
