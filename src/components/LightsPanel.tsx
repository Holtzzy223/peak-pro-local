import { useCallback, useEffect, useRef, useState } from 'react'
import { encodeCbor, hexify } from 'puffcoble-ts'
import { usePuffco } from '../ble/PuffcoContext'
import { ConnectButton } from './ConnectButton'
import { Toggle } from './Toggle'

type Brightness = { base: number; mid: number; glass: number; logo: number }

const ZONES: { key: keyof Brightness; label: string }[] = [
  { key: 'base', label: 'Base ring' },
  { key: 'mid', label: 'Middle' },
  { key: 'glass', label: 'Under glass' },
  { key: 'logo', label: 'Logo' },
]

type Props = {
  onToast: (msg: string, kind?: 'ok' | 'error') => void
}

export function LightsPanel({ onToast }: Props) {
  const { device, status } = usePuffco()
  const connected = status === 'connected' && device !== null
  const [stealth, setStealth] = useState<boolean | null>(null)
  const [brightness, setBrightness] = useState<Brightness | null>(null)
  const [linked, setLinked] = useState(true)
  const [lanternOn, setLanternOn] = useState(false)
  const [lanternColor, setLanternColor] = useState('#ff8a00')
  const brightTimer = useRef<number | undefined>(undefined)

  const fail = useCallback(
    (label: string, e: unknown) => onToast(e instanceof Error ? `${label}: ${e.message}` : label, 'error'),
    [onToast],
  )

  useEffect(() => {
    if (!device || !connected) return
    let cancelled = false
    void (async () => {
      try {
        const s = await device.stealth.isEnabled().catch(() => null)
        const b = await device.led.getBrightness().catch(() => null)
        if (cancelled) return
        setStealth(s)
        setBrightness(b)
      } catch (e) {
        if (!cancelled) fail("Couldn't read lights", e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [device, connected, fail])

  const changeStealth = async (on: boolean) => {
    if (!device) return
    setStealth(on)
    try {
      await (on ? device.stealth.enable() : device.stealth.disable())
      onToast(on ? 'Stealth on' : 'Stealth off')
    } catch (e) {
      setStealth(!on)
      fail('Stealth failed', e)
    }
  }

  const changeBrightness = (key: keyof Brightness, value: number) => {
    if (!brightness || !device) return
    const next = linked
      ? { base: value, mid: value, glass: value, logo: value }
      : { ...brightness, [key]: value }
    setBrightness(next)
    window.clearTimeout(brightTimer.current)
    brightTimer.current = window.setTimeout(() => {
      device.led.setBrightness(next).catch((e) => fail('Brightness failed', e))
    }, 120)
  }

  const writeLanternColor = async (hex: string) => {
    if (!device) return
    const schema = { lamp: { name: 'solid', param: { color: [hex], colorLen: 1 } } }
    await device.writeCborFull('/p/app/ltrn/colr', encodeCbor(hexify(schema)), 80)
  }

  const changeLantern = async (on: boolean) => {
    if (!device) return
    setLanternOn(on)
    try {
      if (on) {
        await writeLanternColor(lanternColor)
        await device.lantern.start()
      } else {
        await device.lantern.stop()
      }
    } catch (e) {
      setLanternOn(!on)
      fail('Lantern failed', e)
    }
  }

  const changeLanternColor = (hex: string) => {
    setLanternColor(hex)
    if (lanternOn) writeLanternColor(hex).catch((e) => fail('Lantern color failed', e))
  }

  return (
    <div className="screen">
      <header className="status-header">
        <h1 className="screen-title">Lighting</h1>
      </header>

      {!connected ? <ConnectButton /> : null}

      <div className="card">
        <div className="setting-row">
          <div>
            <span className="setting-title">Stealth mode</span>
            <span className="setting-sub">Turns the mood lights off</span>
          </div>
          <Toggle label="Stealth mode" checked={Boolean(stealth)} onChange={changeStealth} />
        </div>
      </div>

      <div className="card">
        <div className="setting-row">
          <span className="setting-title">Brightness</span>
          <label className="link-toggle">
            <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} /> Link all
          </label>
        </div>
        {(linked ? ZONES.slice(0, 1) : ZONES).map((zone) => (
          <label key={zone.key} className="field">
            <span className="field-label">
              {linked ? 'All lights' : zone.label}
              <span className="field-value">{brightness ? Math.round((brightness[zone.key] / 255) * 100) : 0}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={255}
              disabled={!brightness}
              value={brightness?.[zone.key] ?? 0}
              onChange={(e) => changeBrightness(zone.key, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      <div className="card">
        <div className="setting-row">
          <div>
            <span className="setting-title">Lantern</span>
            <span className="setting-sub">Glow your Peak like a lamp</span>
          </div>
          <Toggle label="Lantern" checked={lanternOn} onChange={changeLantern} />
        </div>
        <div className="color-row">
          <label className="color-dot" style={{ background: lanternColor, boxShadow: `0 0 18px ${lanternColor}` }}>
            <input type="color" value={lanternColor} onChange={(e) => changeLanternColor(e.target.value)} aria-label="Lantern color" />
          </label>
          <span className="setting-sub">Tap the dot to pick a lantern color</span>
        </div>
      </div>
    </div>
  )
}
