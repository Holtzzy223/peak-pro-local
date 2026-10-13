import type { PuffcoDevice } from 'puffcoble-ts'
import type { ProfileDraft, ProfileSlot } from '../types/preset'
import { writeSlot } from './profileSync'

export async function pushToSlot(
  device: PuffcoDevice,
  slot: ProfileSlot,
  draft: ProfileDraft,
  makeActive: boolean,
): Promise<void> {
  await writeSlot(device, slot, draft)
  if (makeActive) await device.profiles.setCurrent(slot)
}
