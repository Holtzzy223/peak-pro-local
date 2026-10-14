import { useEffect, useRef, useState } from 'react'
import { colorsFromSchema, lampName } from '../ble/colors'
import { usePuffco } from '../ble/PuffcoContext'
import { formatClock, formatDabs } from '../ble/stats'
import { vaporLabel } from '../ble/vapor'
import { haptic } from '../ui/fx'
import { ConnectButton } from './ConnectButton'
import { FavoritesStrip } from './FavoritesStrip'
import { PeakGlow } from './PeakGlow'
import type { SavedPreset } from '../types/preset'

type Props = {
  favorites: SavedPreset[]
  onToast: (msg: string, kind?: 'ok' | 'error') => void
  onEditProfile: () => void
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

const RING_R = 118
const RING_C = 2 * Math.PI * RING_R

export function HomeScreen({ favorites, onToast, onEditProfile }: Props) {
  const { status, device, deviceStatus, slots, reportError } = usePuffco()
  const connected = status === 'connected' && device !== null
  const { phase, heaterTempF, deviceSlot, batteryPercent, charging, totalDabs, deviceName } = deviceStatus
  const live = deviceSlot !== null ? slots[deviceSlot] : slots[0]
  const heating = phase === 'preheat' || phase === 'active'
  const clock = useSessionClock(phase, live.timeS)
  const [boostPulse, setBoostPulse] = useState(0)
  const colors = colorsFromSchema(live.color)
  const vapor = vaporLabel(live.vapor)
  const bowlHot = heaterTempF !== null && heaterTempF >= 110

  let statusText = connected ? 'Ready to rip' : 'Not connected'
  if (phase === 'preheat') statusText = `Heating to ${live.tempF}°`
  else if (phase === 'active') statusText = vapor ? `${vapor} vapor` : 'Enjoy'
  else if (phase === 'fade') statusText = 'Cooling down'
  else if (connected && phase === 'off') statusText = 'Asleep'

  const run = async (fn: () => Promise<void>, label: string) => {
    haptic(14)
    try {
      await fn()
    } catch (e) {
      reportError(e instanceof Error ? `${label} failed: ${e.message}` : `${label} failed`)
    }
  }

  const progress =
    phase === 'preheat'
      ? heaterTempF !== null
        ? heaterTempF / Math.max(1, live.tempF)
        : 0
      : phase === 'active'
        ? clock.remaining / Math.max(1, clock.total)
        : null

  return (
    <div className="screen home-screen">
      <header className="home-top">
        <span className={`conn-pill ${connected ? 'on' : 'off'}`}>
          <span className="conn-dot" />
          {connected ? 'Connected' : status === 'connecting' ? 'Connecting' : 'Offline'}
        </span>
      </header>

      {!connected ? <ConnectButton /> : null}

      {heating ? (
        <section className={`session-ring-wrap ${boostPulse > 0 ? 'boost-pop' : ''}`} key={boostPulse}>
          <svg viewBox="0 0 280 280" className="session-ring" aria-hidden="true">
            <defs>
              <linearGradient id="vaporRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#5ce1ff" />
                <stop offset="55%" stopColor="#c86bff" />
                <stop offset="100%" stopColor="#ff4d9a" />
              </linearGradient>
            </defs>
            <circle cx="140" cy="140" r={RING_R} className="session-ring-track" />
            <circle
              cx="140"
              cy="140"
              r={RING_R}
              className="session-ring-fill"
              stroke="url(#vaporRing)"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - Math.max(0, Math.min(1, progress ?? 0)))}
              transform="rotate(-90 140 140)"
            />
          </svg>
          <div className="session-ring-label">
            <span className="session-ring-temp">
              {heaterTempF !== null ? heaterTempF : live.tempF}
              <small>°F</small>
            </span>
            <span className="session-ring-time">
              {phase === 'active' ? formatClock(clock.remaining) : 'Heating'}
            </span>
          </div>
        </section>
      ) : (
        <section className="home-device">
          <PeakGlow
            colors={colors}
            animation={lampName(live.color)}
            phase={phase}
            progress={null}
            dimmed={!connected}
            showRing={false}
          />
          <h1 className="home-device-name">{deviceName || 'Peak Pro'}</h1>
          <p className={`home-ready ${connected && phase === 'idle' ? 'is-ready' : ''}`}>
            <span className="conn-dot" />
            {statusText}
          </p>
        </section>
      )}

      <div className="home-profile">
        <button type="button" className="home-profile-copy" onClick={onEditProfile}>
          <span className="home-profile-name">{live.name}</span>
          <span className="home-profile-meta">
            {live.tempF}°
            <span>·</span>
            {formatClock(live.timeS)}
            {vapor ? (
              <>
                <span>·</span>
                {vapor}
              </>
            ) : null}
          </span>
        </button>
        {connected && heating ? (
          <div className="home-profile-actions">
            <button
              type="button"
              className="btn btn-boost squish"
              onClick={() =>
                run(async () => {
                  await device.heat.boost()
                  clock.addTime(live.boostTimeS)
                  setBoostPulse((n) => n + 1)
                }, 'Boost')
              }
            >
              Boost
            </button>
            <button type="button" className="btn btn-secondary squish" onClick={() => run(() => device.heat.stop(), 'Stop')}>
              Stop
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="home-start squish"
            disabled={!connected}
            onClick={() => {
              if (!device) return
              void run(() => device.heat.start(), 'Start')
            }}
          >
            Start
          </button>
        )}
      </div>

      {heating ? <p className="home-hint">Slow inhales produce more vapor</p> : null}

      <div className="home-metrics">
        <div className="home-metric">
          <span className="home-metric-label">Battery</span>
          <span className="home-metric-value">
            {batteryPercent !== null ? `${batteryPercent}%` : '—'}
          </span>
          <div className="home-meter">
            <span style={{ width: `${batteryPercent ?? 0}%` }} />
          </div>
          <span className="home-metric-sub">{charging ? 'Charging' : ' '}</span>
        </div>
        <div className="home-metric">
          <span className="home-metric-label">Bowl temp</span>
          <span className="home-metric-value">{heaterTempF !== null ? `${heaterTempF}°` : '—'}</span>
          <div className={`home-meter ${bowlHot ? 'is-hot' : ''}`}>
            <span
              style={{
                width: `${heaterTempF !== null ? Math.min(100, (heaterTempF / Math.max(live.tempF, 1)) * 100) : 0}%`,
              }}
            />
          </div>
          <span className="home-metric-sub">{bowlHot ? 'Hot' : 'Safe to touch'}</span>
        </div>
      </div>

      <div className="home-dabs">
        <span className="home-metric-label">Device dabs</span>
        <span className="home-dabs-value">{formatDabs(totalDabs)}</span>
      </div>

      <FavoritesStrip favorites={favorites} onToast={onToast} />
    </div>
  )
}
