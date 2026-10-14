import { useCallback, useEffect, useState } from 'react'
import { CHAMBER_TYPE, type DeviceInfo } from 'puffcoble-ts'
import { usePuffco } from '../ble/PuffcoContext'
import { takeSnapshot, type DeviceSnapshot } from '../ble/snapshot'
import { formatDabs, readTotalDabs } from '../ble/stats'
import { getVaporPath, setVaporPath } from '../ble/vapor'
import { getSwapSlot, setSwapSlot } from '../storage/settings'
import type { ProfileSlot } from '../types/preset'
import { ConnectButton } from './ConnectButton'

type Props = {
  onToast: (msg: string, kind?: 'ok' | 'error') => void
}

const CHAMBER_NAMES: Record<number, string> = {
  [CHAMBER_TYPE.NONE]: 'None attached',
  [CHAMBER_TYPE.CLASSIC]: 'Classic',
  [CHAMBER_TYPE.XL]: '3DXL',
  [CHAMBER_TYPE.THREE_D]: '3D',
}

export function SettingsPanel({ onToast }: Props) {
  const { device, status } = usePuffco()
  const connected = status === 'connected' && device !== null
  const [info, setInfo] = useState<DeviceInfo | null>(null)
  const [swapSlot, setSwapSlotState] = useState<ProfileSlot>(getSwapSlot)
  const [snapshot, setSnapshot] = useState<DeviceSnapshot | null>(null)
  const [snapping, setSnapping] = useState(false)
  const [vaporPath, setVaporPathState] = useState(getVaporPath)

  const fail = useCallback(
    (label: string, e: unknown) => onToast(e instanceof Error ? `${label}: ${e.message}` : label, 'error'),
    [onToast],
  )

  useEffect(() => {
    if (!device || !connected) return
    let cancelled = false
    void (async () => {
      try {
        const i = await device.info.getAll()
        const dabs = await readTotalDabs(device)
        if (dabs !== null) i.totalDabs = dabs
        else if (typeof i.totalDabs === 'number' && (i.totalDabs < 0 || i.totalDabs > 100_000)) {
          delete i.totalDabs
        }
        if (cancelled) return
        setInfo(i)
      } catch (e) {
        if (!cancelled) fail("Couldn't read settings", e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [device, connected, fail])

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
        <h1 className="screen-title">Settings</h1>
      </header>

      {!connected ? <ConnectButton /> : null}

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
              <dd>{formatDabs(info.totalDabs)}</dd>
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
              Uses your Peak's per-profile intensity setting. Turn it off if vapor levels don't behave the way the
              Puffco app's did.
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
