import type { PuffcoDevice } from 'puffcoble-ts'
import type { ProfileDraft, ProfileSlot } from '../types/preset'
import { writeSlot } from './profileSync'
import { setActiveSlot } from './slots'

export async function pushToSlot(
  device: PuffcoDevice,
  slot: ProfileSlot,
  draft: ProfileDraft,
  makeActive: boolean,
): Promise<void> {
  const { failed } = await writeSlot(device, slot, draft)
  if (makeActive) {
    try {
      await setActiveSlot(device, slot)
    } catch (e) {
      failed.push(`active slot: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (failed.length) throw new Error(failed.join(' · '))
}
