import type { PuffcoDevice } from 'puffcoble-ts'

const MAX_PLAUSIBLE_DABS = 100_000

/** Lifetime dab counts are float32 on Peak Pro firmware AW; uint32 turns the same bytes into millions. */
export function decodeDabs(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const n = Math.round(value)
  if (n < 0 || n > MAX_PLAUSIBLE_DABS) return null
  return n
}

export async function readTotalDabs(device: PuffcoDevice): Promise<number | null> {
  const attempts: Array<{ path: string; type: 'float32' | 'uint32' }> = [
    { path: '/p/app/info/dtot', type: 'float32' },
    { path: '/p/app/odom/0/nc', type: 'float32' },
    { path: '/p/app/info/dtot', type: 'uint32' },
  ]
  for (const { path, type } of attempts) {
    try {
      const n = decodeDabs(await device.read(path, { type }))
      if (n !== null) return n
    } catch {
      /* try the next encoding */
    }
  }
  return null
}

export function formatDabs(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString()
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
