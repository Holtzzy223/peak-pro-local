import type { ProfileSlot } from '../types/preset'

const SWAP_SLOT_KEY = 'peak-local:swap-slot'

export function getSwapSlot(): ProfileSlot {
  const n = Number(localStorage.getItem(SWAP_SLOT_KEY))
  return n >= 0 && n <= 3 && localStorage.getItem(SWAP_SLOT_KEY) !== null ? (n as ProfileSlot) : 3
}

export function setSwapSlot(slot: ProfileSlot) {
  localStorage.setItem(SWAP_SLOT_KEY, String(slot))
}
