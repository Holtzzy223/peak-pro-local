import { useRef, useState } from 'react'
import { pushToSlot } from '../ble/actions'
import { animationKey, prettyAnimationName } from '../ble/animations'
import { colorsFromSchema, lampName, previewGradient } from '../ble/colors'
import { usePuffco } from '../ble/PuffcoContext'
import {
  deletePreset,
  duplicatePreset,
  exportPresetsJson,
  importPresetsJson,
  savePreset,
  toggleFavorite,
} from '../storage/presets'
import { draftToPreset, emptyProfile, presetToDraft, type ProfileSlot, type SavedPreset } from '../types/preset'
import { burst, haptic } from '../ui/fx'

type Props = {
  presets: SavedPreset[]
  onChanged: () => void
  onToast: (msg: string, kind?: 'ok' | 'error') => void
  onGoToDevice: () => void
}

const SLOTS: ProfileSlot[] = [0, 1, 2, 3]

export function PresetLibrary({ presets, onChanged, onToast, onGoToDevice }: Props) {
  const { device, status, slots, setSlots, setDeviceSlot } = usePuffco()
  const connected = status === 'connected' && device !== null
  const [applyTarget, setApplyTarget] = useState<SavedPreset | null>(null)
  const [makeActive, setMakeActive] = useState(true)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const rowRefs = useRef<Record<string, HTMLLIElement | null>>({})

  const apply = async (preset: SavedPreset, slot: ProfileSlot) => {
    setApplyTarget(null)
    if (!device) return
    setApplyingId(preset.id)
    const draft = presetToDraft(preset)
    try {
      await pushToSlot(device, slot, draft, makeActive)
      setSlots((prev) => prev.map((p, i) => (i === slot ? draft : p)))
      if (makeActive) setDeviceSlot(slot)
      burst(colorsFromSchema(preset.color), rowRefs.current[preset.id])
      haptic([12, 40, 12])
      onToast(`"${preset.name}" is in slot ${slot + 1}`)
    } catch (e) {
      onToast(e instanceof Error ? `Apply failed: ${e.message}` : 'Apply failed', 'error')
    } finally {
      setApplyingId(null)
    }
  }

  const addNew = async () => {
    await savePreset(draftToPreset(emptyProfile('New preset')))
    onChanged()
  }

  const rename = async (preset: SavedPreset) => {
    const name = window.prompt('Preset name', preset.name)?.trim()
    if (!name) return
    await savePreset({ ...preset, name: name.slice(0, 16) })
    onChanged()
  }

  const star = async (preset: SavedPreset) => {
    haptic(8)
    await toggleFavorite(preset.id)
    onChanged()
    if (!preset.favorite) onToast(`${preset.name} added to favorites`)
  }

  const exportAll = async () => {
    const json = await exportPresetsJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `peak-local-presets-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onImportFile = async (file: File) => {
    try {
      const count = await importPresetsJson(await file.text())
      onChanged()
      onToast(`Imported ${count} presets`)
    } catch (e) {
      onToast(e instanceof Error ? `Import failed: ${e.message}` : 'Import failed', 'error')
    }
  }

  return (
    <div className="screen">
      <header className="status-header">
        <h1 className="app-title">Library ({presets.length})</h1>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void onImportFile(file)
            e.target.value = ''
          }}
        />
      </header>

      {presets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-orb" />
          <p>Your stash is empty. Dial in a profile on the Device tab and tap Save to Library.</p>
          <button type="button" className="btn btn-secondary squish" onClick={onGoToDevice}>
            Go dial one in
          </button>
        </div>
      ) : (
        <ul className="preset-list">
          {presets.map((preset) => (
            <li key={preset.id} className="preset-row" ref={(el) => void (rowRefs.current[preset.id] = el)}>
              <div
                className="swatch"
                style={{
                  background: previewGradient(preset.color),
                  boxShadow: `0 6px 18px ${colorsFromSchema(preset.color)[0]}55`,
                }}
              />
              <div className="preset-info">
                <div className="preset-head">
                  <button type="button" className="preset-name" onClick={() => rename(preset)}>
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    className={`star squish ${preset.favorite ? 'on' : ''}`}
                    aria-label={preset.favorite ? 'Remove from favorites' : 'Add to favorites'}
                    aria-pressed={Boolean(preset.favorite)}
                    onClick={() => star(preset)}
                  >
                    ★
                  </button>
                </div>
                <span className="preset-meta">
                  {preset.tempF}°F · {preset.timeS}s · boost +{preset.boostTempF}°/+{preset.boostTimeS}s
                  {lampName(preset.color) !== 'solid' ? ` · ${prettyAnimationName(animationKey(preset.color))}` : ''}
                </span>
                <div className="preset-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm squish"
                    disabled={!connected || applyingId !== null}
                    onClick={() => setApplyTarget(preset)}
                  >
                    {applyingId === preset.id ? 'Applying...' : 'Apply to slot'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      await duplicatePreset(preset.id)
                      onChanged()
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm danger"
                    onClick={async () => {
                      if (!window.confirm(`Delete "${preset.name}"?`)) return
                      await deletePreset(preset.id)
                      onChanged()
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="action-row">
        <button type="button" className="btn btn-secondary squish" onClick={addNew}>
          + New preset
        </button>
        <button type="button" className="btn btn-secondary squish" onClick={exportAll} disabled={presets.length === 0}>
          Export all
        </button>
      </div>
      {!connected ? <p className="hint">Connect on the Device tab to apply presets.</p> : null}

      {applyTarget ? (
        <div className="sheet-backdrop" onClick={() => setApplyTarget(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-title">Load "{applyTarget.name}" into...</p>
            <div className="slot-pills">
              {SLOTS.map((slot) => (
                <button key={slot} type="button" className="slot-pill squish" onClick={() => apply(applyTarget, slot)}>
                  <span className="slot-pill-num">{slot + 1}</span>
                  <span className="slot-pill-name">{slots[slot].name}</span>
                </button>
              ))}
            </div>
            <label className="link-toggle">
              <input type="checkbox" checked={makeActive} onChange={(e) => setMakeActive(e.target.checked)} /> Make it
              the active profile
            </label>
            <button type="button" className="btn btn-ghost btn-full" onClick={() => setApplyTarget(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
