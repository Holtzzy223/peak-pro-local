import type { PuffcoDevice } from 'puffcoble-ts'
import { decodeCbor, decodePuffcoJson } from 'puffcoble-ts'
import { slotPath, VAPOR_PATH_CANDIDATES } from './vapor'

const EXTRA_PROBES = [
  '/u/app/rdym',
  '/u/app/ui/rdym',
  '/u/app/hc/0/btmp',
  '/u/app/hc/0/btim',
  '/p/app/ltrn/colr',
  '/p/app/htr/tcmd',
  '/p/app/stat/elap',
  '/p/app/stat/tott',
  '/p/app/odom/0/nc',
  '/p/bat/soc',
]

export type ProbeResult = { path: string; ok: boolean; hex?: string; error?: string }

export type DeviceSnapshot = {
  takenAt: string
  deviceName?: string
  info: unknown
  slotColors: unknown[]
  lanternColor: unknown
  probes: ProbeResult[]
  vaporCandidates: ProbeResult[]
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ')
}

function errorText(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e)
}

/** Makes decoded device data JSON-safe so it can be copied out. */
function jsonSafe(value: unknown): unknown {
  if (value instanceof Uint8Array) return { bytes: toHex(value) }
  if (Array.isArray(value)) return value.map(jsonSafe)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jsonSafe(v)]))
  }
  return value
}

async function probe(device: PuffcoDevice, path: string): Promise<ProbeResult> {
  try {
    const bytes = await device.readShort(path, 0, 64)
    return { path, ok: true, hex: toHex(bytes) }
  } catch (e) {
    return { path, ok: false, error: errorText(e) }
  }
}

/** Read-only: never writes to the device. */
export async function takeSnapshot(device: PuffcoDevice): Promise<DeviceSnapshot> {
  const slotColors: unknown[] = []
  for (const slot of [0, 1, 2, 3] as const) {
    try {
      slotColors.push(jsonSafe(await device.profiles.color(slot)))
    } catch (e) {
      slotColors.push({ error: errorText(e) })
    }
  }

  let lanternColor: unknown
  try {
    lanternColor = jsonSafe(decodePuffcoJson(decodeCbor(await device.readBytesAll('/p/app/ltrn/colr'))))
  } catch (e) {
    lanternColor = { error: errorText(e) }
  }

  const probes: ProbeResult[] = []
  for (const path of EXTRA_PROBES) probes.push(await probe(device, path))

  const vaporCandidates: ProbeResult[] = []
  for (const template of VAPOR_PATH_CANDIDATES) {
    const result = await probe(device, slotPath(template, 0))
    vaporCandidates.push({ ...result, path: template })
  }

  let info: unknown
  try {
    info = jsonSafe(await device.info.getAll())
  } catch (e) {
    info = { error: errorText(e) }
  }

  return {
    takenAt: new Date().toISOString(),
    deviceName: device.name,
    info,
    slotColors,
    lanternColor,
    probes,
    vaporCandidates,
  }
}
