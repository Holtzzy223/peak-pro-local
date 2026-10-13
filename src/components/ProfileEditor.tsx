import { useRef, useState } from 'react'
import { CHAMBER_TYPE } from 'puffcoble-ts'
import { pushToSlot } from '../ble/actions'
import { colorsFromSchema } from '../ble/colors'
import { usePuffco } from '../ble/PuffcoContext'
import { getVaporPath, VAPOR_LEVELS } from '../ble/vapor'
import { savePreset } from '../storage/presets'
import {
  BOOST_TEMP_F_MAX,
  BOOST_TEMP_F_MIN,
  BOOST_TIME_S_MAX,
  BOOST_TIME_S_MIN,
  draftToPreset,
  TEMP_F_MAX,
  TEMP_F_MIN,
  TIME_S_MAX,
  TIME_S_MIN,
  type ProfileDraft,
  type ProfileSlot,
  type SavedPreset,
} from '../types/preset'
import { burst, haptic } from '../ui/fx'
import { AnimationPicker } from './AnimationPicker'
import { ColorPicker } from './ColorPicker'
import { ConnectButton } from './ConnectButton'
import { FavoritesStrip } from './FavoritesStrip'
import { SessionHero } from './SessionHero'
import { SlotCarousel } from './SlotCarousel'
import { TempDial } from './TempDial'

type Props = {
  activeSlot: ProfileSlot
  onSlotChange: (slot: ProfileSlot) => void
  onToast: (msg: string, kind?: 'ok' | 'error') => void
  onLibraryChanged: () => void
  favorites: SavedPreset[]
}

function NumberSlider(props: {
  label: string
  unit: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) {
  const { label, unit, value, min, max, step = 1, onChange } = props
  return (
    <label className="field">
      <span className="field-label">
        {label}
        <span className="field-value">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export function ProfileEditor({ activeSlot, onSlotChange, onToast, onLibraryChanged, favorites }: Props) {
  const { status, device, deviceStatus, slots, setSlots, refreshSlots, rememberAnimations, setDeviceSlot, busy } =
    usePuffco()
  const [saving, setSaving] = useState(false)
  const saveBtn = useRef<HTMLButtonElement>(null)
  const connected = status === 'connected' && device !== null
  const draft = slots[activeSlot]
  const vaporEnabled = getVaporPath() !== null
  const isXl = deviceStatus.chamberType === CHAMBER_TYPE.XL

  const update = (patch: Partial<ProfileDraft>) => {
    setSlots((prev) => prev.map((p, i) => (i === activeSlot ? { ...p, ...patch } : p)))
  }

  const saveToPeak = async (makeActive: boolean) => {
    if (!device) return
    setSaving(true)
    haptic(10)
    try {
      await pushToSlot(device, activeSlot, draft, makeActive)
      rememberAnimations([draft])
      if (makeActive) setDeviceSlot(activeSlot)
      burst(colorsFromSchema(draft.color), saveBtn.current)
      haptic([12, 40, 12])
      onToast(makeActive ? `Slot ${activeSlot + 1} saved and active` : `Saved to slot ${activeSlot + 1}`)
    } catch (e) {
      onToast(e instanceof Error ? `Save failed: ${e.message}` : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const makeActive = async () => {
    if (!device) return
    haptic(10)
    try {
      await device.profiles.setCurrent(activeSlot)
      setDeviceSlot(activeSlot)
      onToast(`Slot ${activeSlot + 1} is live on your Peak`)
    } catch (e) {
      onToast(e instanceof Error ? `Couldn't switch: ${e.message}` : "Couldn't switch", 'error')
    }
  }

  const saveToLibrary = async (e: React.MouseEvent<HTMLButtonElement>) => {
    await savePreset(draftToPreset(draft))
    onLibraryChanged()
    burst(colorsFromSchema(draft.color), e.currentTarget)
    onToast(`"${draft.name}" stashed in your library`)
  }

  return (
    <div className="screen">
      <header className="status-header">
        <div>
          <h1 className="app-title">Peak Local</h1>
          {connected ? (
            <p className="status-line">
              {deviceStatus.batteryPercent !== null ? `${deviceStatus.batteryPercent}%` : ''}
              {deviceStatus.charging ? ' · charging' : ''}
            </p>
          ) : null}
        </div>
        <span className={`conn-pill ${connected ? 'on' : 'off'}`}>
          <span className="conn-dot" />
          {connected ? 'Connected' : status === 'connecting' ? 'Connecting' : 'Offline'}
        </span>
      </header>

      {!connected ? <ConnectButton /> : null}

      <SessionHero preview={draft} />

      <FavoritesStrip favorites={favorites} onToast={onToast} />

      <SlotCarousel
        slots={slots}
        selected={activeSlot}
        deviceSlot={deviceStatus.deviceSlot}
        onSelect={onSlotChange}
      />

      <div className="card">
        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="text-input"
            value={draft.name}
            maxLength={16}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>

        <TempDial
          label="Temperature"
          unit="°F"
          value={draft.tempF}
          min={TEMP_F_MIN}
          max={TEMP_F_MAX}
          onChange={(tempF) => update({ tempF })}
        />
        <NumberSlider
          label="Fine tune"
          unit="°F"
          value={draft.tempF}
          min={TEMP_F_MIN}
          max={TEMP_F_MAX}
          onChange={(tempF) => update({ tempF })}
        />
        <NumberSlider
          label="Session time"
          unit="s"
          value={draft.timeS}
          min={TIME_S_MIN}
          max={TIME_S_MAX}
          onChange={(timeS) => update({ timeS })}
        />
      </div>

      <div className="card">
        <span className="card-title">Boost</span>
        <NumberSlider
          label="Extra heat"
          unit="°F"
          value={draft.boostTempF}
          min={BOOST_TEMP_F_MIN}
          max={BOOST_TEMP_F_MAX}
          onChange={(boostTempF) => update({ boostTempF })}
        />
        <NumberSlider
          label="Extra time"
          unit="s"
          value={draft.boostTimeS}
          min={BOOST_TIME_S_MIN}
          max={BOOST_TIME_S_MAX}
          onChange={(boostTimeS) => update({ boostTimeS })}
        />
      </div>

      {vaporEnabled ? (
        <div className="card">
          <span className="card-title">Vapor control</span>
          <div className="chip-row">
            {VAPOR_LEVELS.filter((l) => !l.xlOnly || isXl).map((level) => (
              <button
                key={level.value}
                type="button"
                className={`chip squish ${draft.vapor === level.value ? 'active' : ''}`}
                onClick={() => update({ vapor: level.value })}
              >
                {level.label}
              </button>
            ))}
          </div>
          {draft.vapor === null ? (
            <p className="hint left">Your Peak didn't report a vapor level for this slot.</p>
          ) : !VAPOR_LEVELS.some((l) => l.value === draft.vapor) ? (
            <p className="hint left">Your Peak reports vapor setting {draft.vapor}, which isn't one of these yet.</p>
          ) : null}
        </div>
      ) : null}

      <div className="card">
        <span className="card-title">Lights</span>
        <AnimationPicker value={draft.color} onChange={(color) => update({ color })} />
        <ColorPicker value={draft.color} onChange={(color) => update({ color })} />
      </div>

      <div className="action-row">
        <button
          type="button"
          className="btn btn-secondary squish"
          disabled={!connected || busy}
          onClick={refreshSlots}
        >
          Read from Peak
        </button>
        <button
          ref={saveBtn}
          type="button"
          className="btn btn-primary squish"
          disabled={!connected || saving}
          onClick={() => saveToPeak(false)}
        >
          {saving ? 'Saving...' : 'Save to Peak'}
        </button>
      </div>
      <div className="action-row">
        <button
          type="button"
          className="btn btn-secondary squish"
          disabled={!connected || saving}
          onClick={deviceStatus.deviceSlot === activeSlot ? () => saveToPeak(true) : makeActive}
        >
          {deviceStatus.deviceSlot === activeSlot ? 'Save + keep active' : 'Make active'}
        </button>
        <button type="button" className="btn btn-ghost squish" onClick={saveToLibrary}>
          Save to Library
        </button>
      </div>

      {connected ? <ConnectButton /> : null}
    </div>
  )
}
