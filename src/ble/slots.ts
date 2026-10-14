import type { PuffcoDevice } from 'puffcoble-ts'
import type { ProfileDraft, ProfileSlot } from '../types/preset'

const STORAGE_KEY = 'peak-local:hcs-base'

/** 0 if /p/app/hcs is 0..3, 1 if the Peak reports the active slot as 1..4. */
export function getHcsBase(): 0 | 1 {
  return localStorage.getItem(STORAGE_KEY) === '1' ? 1 : 0
}

export function setHcsBase(base: 0 | 1) {
  localStorage.setItem(STORAGE_KEY, String(base))
}

export function fromDeviceSlot(raw: unknown, base: 0 | 1 = getHcsBase()): ProfileSlot | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  const slot = Math.round(raw) - base
  if (slot < 0 || slot > 3) return null
  return slot as ProfileSlot
}

export function toDeviceSlot(slot: ProfileSlot, base: 0 | 1 = getHcsBase()): number {
  return slot + base
}

function scoreMatch(draft: ProfileDraft | undefined, name: string, tempF: number): number {
  if (!draft) return 0
  let n = 0
  if (name && draft.name.trim() === name) n += 2
  if (Math.abs(draft.tempF - tempF) <= 2) n += 1
  return n
}

/** Figure out whether the Peak numbers the active slot from 0 or 1 by matching the live profile. */
export async function learnHcsBase(device: PuffcoDevice, slots: ProfileDraft[]): Promise<0 | 1> {
  let raw = 0
  let name = ''
  let tempF = Number.NaN
  try {
    raw = Number(await device.profiles.current())
  } catch {
    return getHcsBase()
  }
  try {
    name = (await device.profiles.name())?.trim() ?? ''
  } catch {
    /* name is only used to break ties */
  }
  try {
    tempF = Number(await device.profiles.temp())
  } catch {
    /* temp is only used to break ties */
  }

  if (raw === 0) {
    setHcsBase(0)
    return 0
  }
  if (raw === 4) {
    setHcsBase(1)
    return 1
  }

  const asZero = scoreMatch(slots[raw], name, tempF)
  const asOne = scoreMatch(slots[raw - 1], name, tempF)
  const base: 0 | 1 = asOne > asZero ? 1 : 0
  setHcsBase(base)
  return base
}

/** Write the active slot without the temp-select begin/end dance, which can land one slot over. */
export async function setActiveSlot(device: PuffcoDevice, slot: ProfileSlot): Promise<void> {
  await device.writeShort('/p/app/hcs', 0, 0, Uint8Array.of(toDeviceSlot(slot)))
}
