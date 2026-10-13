import { useEffect, useRef, useState } from 'react'
import { usePuffco } from '../ble/PuffcoContext'
import { colorsFromSchema, lampName } from '../ble/colors'
import type { ProfileDraft } from '../types/preset'
import { haptic } from '../ui/fx'
import { PeakGlow } from './PeakGlow'

type Props = {
  preview: ProfileDraft
}

function useSessionClock(phase: string, totalS: number) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [extraS, setExtraS] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const prevPhase = useRef(phase)

  useEffect(() => {
    if (phase === 'active' && prevPhase.current !== 'active') {
      setStartedAt(Date.now())
      setExtraS(0)
    }
    if (phase !== 'active' && phase !== 'preheat') setStartedAt(null)
    prevPhase.current = phase
  }, [phase])

  useEffect(() => {
    if (startedAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [startedAt])

  const total = totalS + extraS
  const remaining = startedAt === null ? total : Math.max(0, total - (now - startedAt) / 1000)
  return { remaining, total, addTime: (s: number) => setExtraS((x) => x + s) }
}

export function SessionHero({ preview }: Props) {
  const { status, device, deviceStatus, slots, reportError } = usePuffco()
  const connected = status === 'connected' && device !== null
  const { phase, heaterTempF, deviceSlot } = deviceStatus
  const onDevice = deviceSlot !== null ? slots[deviceSlot] : preview
  const heating = phase === 'preheat' || phase === 'active'
  const clock = useSessionClock(phase, onDevice.timeS)
  const [boostPulse, setBoostPulse] = useState(0)

  const shown = heating ? onDevice : preview
  const colors = colorsFromSchema(shown.color)

  let progress: number | null = null
  let main = `${preview.tempF}°`
  let sub = connected ? 'Ready to rip' : 'Preview'
  if (phase === 'preheat') {
    progress = heaterTempF !== null ? heaterTempF / Math.max(1, onDevice.tempF) : 0
    main = heaterTempF !== null ? `${heaterTempF}°` : '...'
    sub = `Heating up to ${onDevice.tempF}°`
  } else if (phase === 'active') {
    progress = clock.remaining / Math.max(1, clock.total)
    main = `${Math.ceil(clock.remaining)}s`
    sub = heaterTempF !== null ? `${heaterTempF}° · enjoy` : 'Enjoy'
  } else if (phase === 'fade') {
    main = heaterTempF !== null ? `${heaterTempF}°` : 'Done'
    sub = 'Cooling down'
  } else if (connected && phase === 'off') {
    sub = 'Peak is asleep'
  }

  const run = async (fn: () => Promise<void>, label: string) => {
    haptic(14)
    try {
      await fn()
    } catch (e) {
      reportError(e instanceof Error ? `${label} failed: ${e.message}` : `${label} failed`)
    }
  }

  return (
    <section className="hero">
      <div key={boostPulse} className={boostPulse > 0 ? 'boost-pop' : undefined}>
        <PeakGlow
          colors={colors}
          animation={lampName(shown.color)}
          phase={phase}
          progress={progress}
          centerLabel={main}
          subLabel={sub}
          dimmed={!connected}
        />
      </div>
      {connected ? (
        <div className="session-controls">
          {heating ? (
            <>
              <button
                type="button"
                className="btn btn-boost squish"
                onClick={() =>
                  run(async () => {
                    await device.heat.boost()
                    clock.addTime(onDevice.boostTimeS)
                    setBoostPulse((n) => n + 1)
                  }, 'Boost')
                }
              >
                Boost +{onDevice.boostTempF}°
              </button>
              <button type="button" className="btn btn-secondary squish" onClick={() => run(() => device.heat.stop(), 'Stop')}>
                Stop
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-start squish"
              onClick={() => run(() => device.heat.start(), 'Start')}
            >
              Start {deviceSlot !== null ? `· ${slots[deviceSlot].name}` : ''}
            </button>
          )}
        </div>
      ) : null}
    </section>
  )
}
