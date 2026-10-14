import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { colorsFromSchema } from './ble/colors'
import { PuffcoProvider, usePuffco } from './ble/PuffcoContext'
import { HomeScreen } from './components/HomeScreen'
import { LightsPanel } from './components/LightsPanel'
import { PresetLibrary } from './components/PresetLibrary'
import { ProfileEditor } from './components/ProfileEditor'
import { SettingsPanel } from './components/SettingsPanel'
import { listPresets } from './storage/presets'
import type { ProfileSlot, SavedPreset } from './types/preset'
import { haptic } from './ui/fx'
import './App.css'

type Tab = 'home' | 'profiles' | 'lights' | 'settings'
type Toast = { id: number; text: string; kind: 'ok' | 'error' }

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'lights', label: 'Lighting' },
  { id: 'settings', label: 'Settings' },
]

function TabIcon({ id }: { id: Tab }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (id === 'home') {
    return (
      <svg {...common}>
        <path d="M4 11 12 4l8 7v9H4z" />
        <path d="M9 20v-6h6v6" />
      </svg>
    )
  }
  if (id === 'profiles') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="7" />
        <path d="M12 8v4l2.5 1.5" />
      </svg>
    )
  }
  if (id === 'lights') {
    return (
      <svg {...common}>
        <path d="M9 18h6M10 21h4" />
        <path d="M8 10a4 4 0 1 1 8 0c0 2.2-1.4 3.4-2 4.5-.3.6-.6 1.5-.8 2.5h-2.4c-.2-1-.5-1.9-.8-2.5-.6-1.1-2-2.3-2-4.5z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" />
    </svg>
  )
}

function Shell() {
  const { bleSupported, lastError, clearError, status, slots } = usePuffco()
  const [tab, setTab] = useState<Tab>('home')
  const [libraryOpen, setLibraryOpen] = useState(false)
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
      showToast('Connected')
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

  let body: ReactNode
  if (tab === 'home') {
    body = (
      <HomeScreen
        favorites={favorites}
        onToast={showToast}
        onEditProfile={() => {
          setLibraryOpen(false)
          setTab('profiles')
        }}
      />
    )
  } else if (tab === 'profiles' && libraryOpen) {
    body = (
      <PresetLibrary
        presets={presets}
        onChanged={reloadPresets}
        onToast={showToast}
        onGoToDevice={() => {
          setLibraryOpen(false)
          setTab('home')
        }}
        onBack={() => setLibraryOpen(false)}
      />
    )
  } else if (tab === 'profiles') {
    body = (
      <ProfileEditor
        activeSlot={activeSlot}
        onSlotChange={setActiveSlot}
        onToast={showToast}
        onLibraryChanged={reloadPresets}
        onOpenLibrary={() => setLibraryOpen(true)}
      />
    )
  } else if (tab === 'lights') {
    body = <LightsPanel onToast={showToast} />
  } else {
    body = <SettingsPanel onToast={showToast} />
  }

  return (
    <div className="app" style={themeVars}>
      <div className="bg-blobs" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
      </div>

      {!bleSupported ? (
        <div className="banner">
          Bluetooth isn't available here. On iPhone open this page in Path Browser; on desktop use Chrome or Edge
          over HTTPS.
        </div>
      ) : null}

      <main className="content" key={`${tab}-${libraryOpen}`}>
        {body}
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
              setLibraryOpen(false)
              setTab(t.id)
            }}
          >
            <TabIcon id={t.id} />
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
