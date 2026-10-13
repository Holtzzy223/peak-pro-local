import type { LampColorSchema } from '../types/preset'
import { lampName } from './colors'

const STORAGE_KEY = 'peak-local:animations'

export type AnimationCatalog = Record<string, LampColorSchema>

export function loadCatalog(): AnimationCatalog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AnimationCatalog) : {}
  } catch {
    return {}
  }
}

/** Remembers each animation the device has used so it can be picked for other slots later. */
export function learnAnimations(catalog: AnimationCatalog, schemas: LampColorSchema[]): AnimationCatalog {
  let changed = false
  const next = { ...catalog }
  for (const schema of schemas) {
    const name = lampName(schema)
    if (name === 'solid' || next[name]) continue
    next[name] = structuredClone(schema)
    changed = true
  }
  if (!changed) return catalog
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* catalog is a convenience; ignore quota errors */
  }
  return next
}

export function prettyAnimationName(name: string): string {
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
