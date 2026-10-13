import { useEffect, useRef } from 'react'
import { colorsFromSchema, previewGradient } from '../ble/colors'
import type { ProfileDraft, ProfileSlot } from '../types/preset'
import { haptic } from '../ui/fx'

type Props = {
  slots: ProfileDraft[]
  selected: ProfileSlot
  deviceSlot: ProfileSlot | null
  onSelect: (slot: ProfileSlot) => void
}

export function SlotCarousel({ slots, selected, deviceSlot, onSelect }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<number | undefined>(undefined)
  const programmatic = useRef(false)

  useEffect(() => {
    const track = trackRef.current
    const card = track?.children[selected] as HTMLElement | undefined
    if (!track || !card) return
    programmatic.current = true
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.clientWidth) / 2, behavior: 'smooth' })
    window.setTimeout(() => (programmatic.current = false), 400)
  }, [selected])

  const onScroll = () => {
    if (programmatic.current) return
    window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(() => {
      const track = trackRef.current
      if (!track) return
      const center = track.scrollLeft + track.clientWidth / 2
      let best = 0
      let bestDist = Infinity
      Array.from(track.children).forEach((el, i) => {
        const c = (el as HTMLElement).offsetLeft + (el as HTMLElement).clientWidth / 2
        const d = Math.abs(c - center)
        if (d < bestDist) {
          bestDist = d
          best = i
        }
      })
      if (best !== selected) {
        haptic(8)
        onSelect(best as ProfileSlot)
      }
    }, 110)
  }

  return (
    <div className="slot-track" ref={trackRef} onScroll={onScroll}>
      {slots.map((slot, i) => {
        const main = colorsFromSchema(slot.color)[0]
        const isSel = i === selected
        return (
          <button
            key={i}
            type="button"
            className={`slot-card ${isSel ? 'selected' : ''}`}
            style={{
              borderColor: isSel ? main : undefined,
              boxShadow: isSel ? `0 10px 30px ${main}55` : undefined,
            }}
            onClick={() => onSelect(i as ProfileSlot)}
          >
            <span className="slot-card-stripe" style={{ background: previewGradient(slot.color) }} />
            <span className="slot-card-top">
              <span className="slot-card-num">{i + 1}</span>
              {deviceSlot === i ? <span className="slot-badge">On Peak</span> : null}
            </span>
            <span className="slot-card-name">{slot.name}</span>
            <span className="slot-card-temp">{slot.tempF}°</span>
            <span className="slot-card-time">{slot.timeS}s</span>
          </button>
        )
      })}
    </div>
  )
}
