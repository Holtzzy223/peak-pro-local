import type { PuffcoDevice } from 'puffcoble-ts'
import type { ProfileDraft, ProfileSlot } from '../types/preset'
import { DEFAULT_BOOST_TEMP_F, DEFAULT_BOOST_TIME_S } from '../types/preset'
import { encodeColorSchema, normalizeColorSchema } from './colors'
import { getVaporPath, slotPath } from './vapor'

function fToC(tempF: number): number {
  return (tempF - 32) / 1.8
}

function encodeProfileName(name: string): Uint8Array {
  const bytes = new TextEncoder().encode(name.trim().slice(0, 16))
  const out = new Uint8Array(16)
  out.set(bytes.subarray(0, 16))
  return out
}

async function readOptional<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch {
    return null
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Boost temperature is stored as a Celsius difference, so no 32-degree offset applies. */
async function readBoost(device: PuffcoDevice, slot: ProfileSlot) {
  const base = `/u/app/hc/${slot}`
  const tempC = await readOptional(() => device.read(`${base}/btmp`, { type: 'float32' }))
  const timeS = await readOptional(() => device.read(`${base}/btim`, { type: 'float32' }))
  return {
    boostTempF: typeof tempC === 'number' ? Math.round(tempC * 1.8) : DEFAULT_BOOST_TEMP_F,
    boostTimeS: typeof timeS === 'number' ? Math.round(timeS) : DEFAULT_BOOST_TIME_S,
  }
}

async function readVapor(device: PuffcoDevice, slot: ProfileSlot): Promise<number | null> {
  const template = getVaporPath()
  if (!template) return null
  const path = slotPath(template, slot)
  const asByte = await readOptional(() => device.readShort(path, 0, 1))
  if (asByte && asByte.length > 0 && asByte[0] <= 3) return asByte[0]
  const value = await readOptional(() => device.read(path, { type: 'float32' }))
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

export async function readSlot(device: PuffcoDevice, slot: ProfileSlot): Promise<ProfileDraft> {
  const profile = await device.profiles.read(slot)
  const boost = await readBoost(device, slot)
  return {
    name: profile.name?.trim() || `Profile ${slot + 1}`,
    tempF: Math.round(profile.tempF ?? 450),
    timeS: Math.round(profile.timeS ?? 40),
    ...boost,
    vapor: await readVapor(device, slot),
    color: normalizeColorSchema(profile.color),
  }
}

export async function readAllSlots(device: PuffcoDevice): Promise<ProfileDraft[]> {
  const out: ProfileDraft[] = []
  for (const slot of [0, 1, 2, 3] as ProfileSlot[]) out.push(await readSlot(device, slot))
  return out
}

export type SlotWriteResult = { failed: string[] }

export async function writeSlot(device: PuffcoDevice, slot: ProfileSlot, draft: ProfileDraft): Promise<SlotWriteResult> {
  const base = `/u/app/hc/${slot}`
  const failed: string[] = []

  const attempt = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (e) {
      failed.push(`${label}: ${errorText(e)}`)
    }
  }

  await attempt('temp', () => device.write(`${base}/temp`, fToC(draft.tempF), { type: 'float32' }))
  await attempt('time', () => device.write(`${base}/time`, draft.timeS, { type: 'float32' }))
  await attempt('name', async () => {
    const raw = new TextEncoder().encode(draft.name.trim().slice(0, 16))
    try {
      await device.writeShort(`${base}/name`, 0, 0, raw)
    } catch {
      await device.writeShort(`${base}/name`, 0, 0, encodeProfileName(draft.name))
    }
  })
  await attempt('boost temp', () => device.write(`${base}/btmp`, draft.boostTempF / 1.8, { type: 'float32' }))
  await attempt('boost time', () => device.write(`${base}/btim`, draft.boostTimeS, { type: 'float32' }))
  await attempt('color', () => device.writeCborFull(`${base}/colr`, encodeColorSchema(draft.color), 80))
  return { failed }
}
