import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { colorsFromSchema } from './ble/colors'
import { PuffcoProvider, usePuffco } from './ble/PuffcoContext'
import { PresetLibrary } from './components/PresetLibrary'
import { ProfileEditor } from './components/ProfileEditor'
import { SettingsPanel } from './components/SettingsPanel'
import { listPresets } from './storage/presets'
import type { ProfileSlot, SavedPreset } from './types/preset'
import { haptic } from './ui/fx'
import './App.css'

type Tab = 'device' | 'library' | 'settings'
type Toast = { id: number; text: string; kind: 'ok' | 'error' }

const TABS: { id: Tab; label: string }[] = [
  { id: 'device', label: 'Device' },
  { id: 'library', label: 'Library' },
  { id: 'settings', label: 'Settings' },
]

function Shell() {
  const { bleSupported, lastError, clearError, status, slots } = usePuffco()
  const [tab, setTab] = useState<Tab>('device')
  const [activeSlot, setActiveSlot] = useState<ProfileSlot>(0)
  const [presets, setPresets] = useState<SavedPreset[]>([])
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const wasConnected = useRef(false)

  const showToast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    if (kind === 'error') haptic([30, 50, 30])
    setToast({ id: Date.now(), text, kind })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3000)
  }, [])

  const reloadPresets = useCallback(async () => {
    setPresets(await listPresets())
  }, [])

  useEffect(() => {
    void listPresets().then(setPresets)
  }, [])

  useEffect(() => {
    if (!lastError) return
    showToast(lastError, 'error')
    clearError()
  }, [lastError, clearError, showToast])

  useEffect(() => {
    if (status === 'connected' && !wasConnected.current) {
      wasConnected.current = true
      showToast('Connected. Your Peak says hi.')
    }
    if (status === 'disconnected' && wasConnected.current) {
      wasConnected.current = false
      showToast('Disconnected. Tap Connect to hop back on.', 'error')
    }
  }, [status, showToast])

  const favorites = useMemo(() => presets.filter((p) => p.favorite), [presets])

  const colors = colorsFromSchema(slots[activeSlot].color)
  const themeVars = {
    '--accent': colors[0],
    '--accent-2': colors[1] ?? colors[0],
    '--accent-3': colors[2] ?? colors[1] ?? colors[0],
  } as CSSProperties

  return (
    <div className="app" style={themeVars}>
      <div className="bg-blobs" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>

      {!bleSupported ? (
        <div className="banner">
          Bluetooth isn't available here. On iPhone open this page in Path Browser; on desktop use Chrome or Edge
          over HTTPS.
        </div>
      ) : null}

      <main className="content" key={tab}>
        {tab === 'device' ? (
          <ProfileEditor
            activeSlot={activeSlot}
            onSlotChange={setActiveSlot}
            onToast={showToast}
            onLibraryChanged={reloadPresets}
            favorites={favorites}
          />
        ) : tab === 'library' ? (
          <PresetLibrary
            presets={presets}
            onChanged={reloadPresets}
            onToast={showToast}
            onGoToDevice={() => setTab('device')}
          />
        ) : (
          <SettingsPanel onToast={showToast} />
        )}
      </main>

      {toast ? (
        <div key={toast.id} className={`toast ${toast.kind === 'error' ? 'toast-error' : ''}`} role="status">
          {toast.text}
        </div>
      ) : null}

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'active' : ''}
            onClick={() => {
              haptic(6)
              setTab(t.id)
            }}
          >
            <span className="tab-dot" />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <PuffcoProvider>
      <Shell />
    </PuffcoProvider>
  )
}
