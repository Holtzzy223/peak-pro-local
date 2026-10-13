import { useState } from 'react'
import { pushToSlot } from '../ble/actions'
import { colorsFromSchema, previewGradient } from '../ble/colors'
import { usePuffco } from '../ble/PuffcoContext'
import { getSwapSlot } from '../storage/settings'
import { presetToDraft, type SavedPreset } from '../types/preset'
import { burst, haptic } from '../ui/fx'

type Props = {
  favorites: SavedPreset[]
  onToast: (msg: string, kind?: 'ok' | 'error') => void
}

export function FavoritesStrip({ favorites, onToast }: Props) {
  const { device, status, setSlots, setDeviceSlot } = usePuffco()
  const [swapping, setSwapping] = useState<string | null>(null)
  const connected = status === 'connected' && device !== null

  if (favorites.length === 0) return null

  const swap = async (preset: SavedPreset, el: HTMLElement) => {
    if (!device) return
    const slot = getSwapSlot()
    const draft = presetToDraft(preset)
    setSwapping(preset.id)
    haptic(10)
    try {
      await pushToSlot(device, slot, draft, true)
      setSlots((prev) => prev.map((p, i) => (i === slot ? draft : p)))
      setDeviceSlot(slot)
      burst(colorsFromSchema(preset.color), el)
      haptic([12, 40, 12])
      onToast(`${preset.name} is loaded in slot ${slot + 1}. Let's go!`)
    } catch (e) {
      onToast(e instanceof Error ? `Swap failed: ${e.message}` : 'Swap failed', 'error')
    } finally {
      setSwapping(null)
    }
  }

  return (
    <section className="favorites">
      <span className="section-label">Favorites · tap to load</span>
      <div className="fav-row">
        {favorites.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`fav-chip squish ${swapping === preset.id ? 'is-loading' : ''}`}
            disabled={!connected || swapping !== null}
            onClick={(e) => swap(preset, e.currentTarget)}
          >
            <span className="fav-dot" style={{ background: previewGradient(preset.color) }} />
            <span className="fav-name">{preset.name}</span>
            <span className="fav-temp">{preset.tempF}°</span>
          </button>
        ))}
      </div>
    </section>
  )
}
