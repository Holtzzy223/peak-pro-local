import type { LampColorSchema } from '../types/preset'
import { lampName } from './colors'

const STORAGE_KEY = 'peak-local:animations'

/** Peak Pro firmware runs every profile animation through "pikaled2" and picks the effect with param.anim. */
const MULTI_EFFECT_LAMPS = new Set(['pikaled2'])

export type AnimationCatalog = Record<string, LampColorSchema>

/** Identifies an animation; pikaled2 effects are told apart by their anim number. */
export function animationKey(schema: LampColorSchema): string {
  const name = lampName(schema)
  const anim = schema.lamp?.param?.anim
  return MULTI_EFFECT_LAMPS.has(name) && typeof anim === 'number' ? `${name}#${anim}` : name
}

function save(catalog: AnimationCatalog) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog))
  } catch {
    /* catalog is a convenience; ignore quota errors */
  }
}

export function loadCatalog(): AnimationCatalog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const stored = raw ? (JSON.parse(raw) as AnimationCatalog) : {}
    const catalog: AnimationCatalog = {}
    for (const schema of Object.values(stored)) catalog[animationKey(schema)] = schema
    if (Object.keys(catalog).join() !== Object.keys(stored).join()) save(catalog)
    return catalog
  } catch {
    return {}
  }
}

/** Remembers each animation the device has used so it can be picked for other slots later. */
export function learnAnimations(catalog: AnimationCatalog, schemas: LampColorSchema[]): AnimationCatalog {
  let changed = false
  const next = { ...catalog }
  for (const schema of schemas) {
    const key = animationKey(schema)
    if (key === 'solid' || next[key]) continue
    next[key] = structuredClone(schema)
    changed = true
  }
  if (!changed) return catalog
  save(next)
  return next
}

export function prettyAnimationName(key: string): string {
  const [name, anim] = key.split('#')
  if (MULTI_EFFECT_LAMPS.has(name)) return anim !== undefined ? `Animated ${anim}` : 'Animated'
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}

export type GlowStyle = 'solid' | 'breathe' | 'rise' | 'circle' | 'cycle'

/** Maps an animation name onto the closest preview effect for the on-screen Peak. */
export function glowStyleFor(name: string): GlowStyle {
  const n = name.toLowerCase()
  if (n === 'solid' || n === 'static') return 'solid'
  if (n.includes('breath') || n.includes('pulse') || n.includes('fade')) return 'breathe'
  if (n.includes('ris') || n.includes('wave') || n.includes('up')) return 'rise'
  if (n.includes('circ') || n.includes('spin') || n.includes('orbit') || n.includes('rotat')) return 'circle'
  return 'cycle'
}
