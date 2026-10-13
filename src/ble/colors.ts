import { encodeCbor, ulid26To16 } from 'puffcoble-ts'
import type { LampColorSchema, LampParam } from '../types/preset'
import { defaultSolidColor } from '../types/preset'

const FALLBACK = '#4488ff'
const HEX6 = /^#?([0-9a-fA-F]{6})$/
export const MAX_COLORS = 6

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !(v instanceof Uint8Array) && !Array.isArray(v)
}

export function colorsFromSchema(schema: unknown): string[] {
  if (!isRecord(schema) || !isRecord(schema.lamp)) return [FALLBACK]
  const param = schema.lamp.param
  if (!isRecord(param) || !Array.isArray(param.color)) return [FALLBACK]
  const colors = param.color.filter((c): c is string => typeof c === 'string' && HEX6.test(c))
  return colors.length > 0 ? colors : [FALLBACK]
}

export function lampName(schema: unknown): string {
  if (isRecord(schema) && isRecord(schema.lamp) && typeof schema.lamp.name === 'string') {
    return schema.lamp.name
  }
  return 'solid'
}

/** Keeps every field the device sent (speed, direction, etc.) so saving never strips an animation. */
export function normalizeColorSchema(raw: unknown): LampColorSchema {
  if (!isRecord(raw) || !isRecord(raw.lamp)) return defaultSolidColor(FALLBACK)
  const lamp = raw.lamp
  const param: LampParam = isRecord(lamp.param) ? { ...lamp.param } : {}
  const colors = colorsFromSchema(raw)
  param.color = colors
  param.colorLen = colors.length
  return {
    ...raw,
    lamp: {
      ...lamp,
      name: typeof lamp.name === 'string' ? lamp.name : 'solid',
      param,
    },
  }
}

function withColors(schema: LampColorSchema, colors: string[]): LampColorSchema {
  return {
    ...schema,
    lamp: {
      ...schema.lamp,
      param: { ...schema.lamp.param, color: colors, colorLen: colors.length },
    },
  }
}

export function setColorAt(schema: LampColorSchema, index: number, hex: string): LampColorSchema {
  const colors = [...colorsFromSchema(schema)]
  colors[index] = hex
  return withColors(schema, colors)
}

export function addColor(schema: LampColorSchema, hex: string): LampColorSchema {
  const colors = colorsFromSchema(schema)
  if (colors.length >= MAX_COLORS) return schema
  return withColors(schema, [...colors, hex])
}

export function removeColorAt(schema: LampColorSchema, index: number): LampColorSchema {
  const colors = colorsFromSchema(schema)
  if (colors.length <= 1) return schema
  return withColors(
    schema,
    colors.filter((_, i) => i !== index),
  )
}

/** Switches animation while keeping the user's colors; template supplies the animation's other params. */
export function applyAnimation(
  schema: LampColorSchema,
  name: string,
  template?: LampColorSchema,
): LampColorSchema {
  const colors = colorsFromSchema(schema)
  const base = template ? structuredClone(template) : { lamp: { name, param: {} } }
  return withColors({ ...base, lamp: { ...base.lamp, name } }, colors)
}

export function previewGradient(schema: unknown): string {
  const colors = colorsFromSchema(schema)
  if (colors.length === 1) return colors[0]
  return `linear-gradient(90deg, ${colors.join(', ')})`
}

function hexToBytes(hex: string): Uint8Array {
  const h = HEX6.exec(hex)![1]
  return Uint8Array.of(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16))
}

/** Same rules as puffcoble-ts hexify, but passes raw byte fields through instead of mangling them. */
function toDeviceShape(o: unknown, key?: string): unknown {
  if (o === null || o === undefined) return o
  if (o instanceof Uint8Array) return o
  if (Array.isArray(o)) {
    if (key === 'color') {
      const parts = o.filter((x): x is string => typeof x === 'string' && HEX6.test(x)).map(hexToBytes)
      const out = new Uint8Array(parts.length * 3)
      parts.forEach((p, i) => out.set(p, i * 3))
      return out
    }
    if (key === 'userColors') {
      return o.map((x) => (typeof x === 'string' && HEX6.test(x) ? hexToBytes(x) : toDeviceShape(x)))
    }
    return o.map((x) => toDeviceShape(x))
  }
  if (typeof o === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) out[k] = toDeviceShape(v, k)
    return out
  }
  if (typeof o === 'string') {
    if (key?.endsWith('Ulid') && o.length === 26) return ulid26To16(o)
    if (HEX6.test(o)) return hexToBytes(o)
  }
  return o
}

export function encodeColorSchema(schema: LampColorSchema): Uint8Array {
  return encodeCbor(toDeviceShape(schema))
}
