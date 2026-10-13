import { useCallback, useEffect, useRef, useState } from 'react'
import { CHAMBER_TYPE, encodeCbor, hexify, type DeviceInfo } from 'puffcoble-ts'
import { usePuffco } from '../ble/PuffcoContext'
import { takeSnapshot, type DeviceSnapshot } from '../ble/snapshot'
import { getVaporPath, setVaporPath } from '../ble/vapor'
import { getSwapSlot, setSwapSlot } from '../storage/settings'
import type { ProfileSlot } from '../types/preset'
import { haptic } from '../ui/fx'
import { ConnectButton } from './ConnectButton'

type Props = {
  onToast: (msg: string, kind?: 'ok' | 'error') => void
}

type Brightness = { base: number; mid: number; glass: number; logo: number }

const ZONES: { key: keyof Brightness; label: string }[] = [
  { key: 'base', label: 'Base ring' },
  { key: 'mid', label: 'Middle' },
  { key: 'glass', label: 'Under glass' },
  { key: 'logo', label: 'Logo' },
]

const CHAMBER_NAMES: Record<number, string> = {
  [CHAMBER_TYPE.NONE]: 'None attached',
  [CHAMBER_TYPE.CLASSIC]: 'Classic',
  [CHAMBER_TYPE.XL]: '3DXL',
  [CHAMBER_TYPE.THREE_D]: '3D',
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'on' : ''}`}
      onClick={() => {
        haptic(8)
        onChange(!checked)
      }}
    >
      <span className="toggle-knob" />
    </button>
  )
}

export function SettingsPanel({ onToast }: Props) {
  const { device, status } = usePuffco()
  const connected = status === 'connected' && device !== null
  const [stealth, setStealth] = useState<boolean | null>(null)
  const [brightness, setBrightness] = useState<Brightness | null>(null)
  const [linked, setLinked] = useState(true)
  const [lanternOn, setLanternOn] = useState(false)
  const [lanternColor, setLanternColor] = useState('#ff8a00')
  const [info, setInfo] = useState<DeviceInfo | null>(null)
  const [swapSlot, setSwapSlotState] = useState<ProfileSlot>(getSwapSlot)
  const [snapshot, setSnapshot] = useState<DeviceSnapshot | null>(null)
  const [snapping, setSnapping] = useState(false)
  const [vaporPath, setVaporPathState] = useState(getVaporPath)
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
        const i = await device.info.getAll()
        if (i.totalDabs === undefined) {
          try {
            i.totalDabs = Number(await device.read('/p/app/odom/0/nc', { type: 'uint32' }))
          } catch {
            /* stat unavailable on this firmware */
          }
        }
        if (cancelled) return
        setStealth(s)
        setBrightness(b)
        setInfo(i)
      } catch (e) {
        if (!cancelled) fail("Couldn't read settings", e)
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
      onToast(on ? 'Stealth on. Shhh.' : 'Stealth off. Lights back on.')
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

  const runSnapshot = async () => {
    if (!device) return
    setSnapping(true)
    try {
      setSnapshot(await takeSnapshot(device))
      onToast('Snapshot ready')
    } catch (e) {
      fail('Snapshot failed', e)
    } finally {
      setSnapping(false)
    }
  }

  const copySnapshot = async () => {
    if (!snapshot) return
    const text = JSON.stringify(snapshot, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      onToast('Copied! Paste it into the chat.')
    } catch {
      onToast('Copy blocked. Long-press the text box below to copy.', 'error')
    }
  }

  const answeringVapor = snapshot?.vaporCandidates.filter((c) => c.ok) ?? []

  return (
    <div className="screen">
      <header className="status-header">
        <h1 className="app-title">Settings</h1>
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

      <div className="card">
        <span className="setting-title">Favorites load into</span>
        <div className="slot-pills">
          {([0, 1, 2, 3] as ProfileSlot[]).map((slot) => (
            <button
              key={slot}
              type="button"
              className={`slot-pill squish ${swapSlot === slot ? 'active' : ''}`}
              onClick={() => {
                setSwapSlot(slot)
                setSwapSlotState(slot)
              }}
            >
              {slot + 1}
            </button>
          ))}
        </div>
        <span className="setting-sub">Tapping a favorite overwrites this slot and makes it active.</span>
      </div>

      {info ? (
        <div className="card">
          <span className="setting-title">Your Peak</span>
          <dl className="stats">
            <div>
              <dt>Total dabs</dt>
              <dd>{info.totalDabs ?? '—'}</dd>
            </div>
            <div>
              <dt>Dabs per day</dt>
              <dd>{info.dabsPerDay ?? '—'}</dd>
            </div>
            <div>
              <dt>Dabs left on battery</dt>
              <dd>{info.dabsRemaining ?? '—'}</dd>
            </div>
            <div>
              <dt>Chamber</dt>
              <dd>{info.chamberType !== undefined ? (CHAMBER_NAMES[info.chamberType] ?? `Type ${info.chamberType}`) : '—'}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{info.productInfo?.marketingName ?? info.productInfo?.type ?? '—'}</dd>
            </div>
            <div>
              <dt>Firmware</dt>
              <dd>{info.softwareVersion ?? '—'}</dd>
            </div>
            <div className="wide">
              <dt>Serial</dt>
              <dd>{info.serialNumber ?? '—'}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="card">
        <span className="setting-title">Device snapshot</span>
        <span className="setting-sub">
          Reads (never changes) your Peak's light animations and hidden settings so missing features can be
          unlocked. Copy it and paste it into the chat.
        </span>
        <div className="action-row">
          <button type="button" className="btn btn-secondary squish" disabled={!connected || snapping} onClick={runSnapshot}>
            {snapping ? 'Reading...' : 'Take snapshot'}
          </button>
          <button type="button" className="btn btn-primary squish" disabled={!snapshot} onClick={copySnapshot}>
            Copy
          </button>
        </div>
        {snapshot ? <textarea className="snapshot-box" readOnly value={JSON.stringify(snapshot, null, 2)} /> : null}

        {answeringVapor.length > 0 || vaporPath ? (
          <div className="vapor-setup">
            <span className="setting-title">Vapor control (experimental)</span>
            <span className="setting-sub">
              Only turn this on if the chat confirms which setting is vapor control. Writing the wrong one could
              change a different setting on your Peak.
            </span>
            {answeringVapor.map((c) => (
              <label key={c.path} className="radio-row">
                <input
                  type="radio"
                  name="vapor-path"
                  checked={vaporPath === c.path}
                  onChange={() => {
                    setVaporPath(c.path)
                    setVaporPathState(c.path)
                  }}
                />
                <code>{c.path}</code> <span className="setting-sub">reads {c.hex || '(empty)'}</span>
              </label>
            ))}
            {vaporPath ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm danger"
                onClick={() => {
                  setVaporPath(null)
                  setVaporPathState(null)
                }}
              >
                Turn off vapor control ({vaporPath})
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {connected ? <ConnectButton /> : null}
    </div>
  )
}
