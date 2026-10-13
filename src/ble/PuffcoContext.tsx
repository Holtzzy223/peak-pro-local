import {
  connect,
  connectLastKnown,
  isSupported,
  OPERATING_STATE,
  PuffcoDeviceNotFound,
  PuffcoUnsupportedBrowser,
  type PuffcoDevice,
} from 'puffcoble-ts'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ProfileDraft, ProfileSlot } from '../types/preset'
import { emptyProfile } from '../types/preset'
import { learnAnimations, loadCatalog, type AnimationCatalog } from './animations'
import { readAllSlots } from './profileSync'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

export type SessionPhase = 'off' | 'idle' | 'preheat' | 'active' | 'fade'

export type DeviceStatus = {
  batteryPercent: number | null
  charging: boolean
  phase: SessionPhase
  heaterTempF: number | null
  deviceSlot: ProfileSlot | null
  chamberType: number | null
}

type PuffcoContextValue = {
  bleSupported: boolean
  status: ConnectionStatus
  device: PuffcoDevice | null
  deviceStatus: DeviceStatus
  slots: ProfileDraft[]
  setSlots: React.Dispatch<React.SetStateAction<ProfileDraft[]>>
  animations: AnimationCatalog
  rememberAnimations: (drafts: ProfileDraft[]) => void
  connectDevice: () => Promise<void>
  disconnectDevice: () => void
  refreshSlots: () => Promise<void>
  setDeviceSlot: (slot: ProfileSlot) => void
  busy: boolean
  lastError: string | null
  reportError: (message: string) => void
  clearError: () => void
}

const PuffcoContext = createContext<PuffcoContextValue | null>(null)

const DEFAULT_SLOTS: ProfileDraft[] = [1, 2, 3, 4].map((n) => emptyProfile(`Profile ${n}`))

const OFFLINE_STATUS: DeviceStatus = {
  batteryPercent: null,
  charging: false,
  phase: 'off',
  heaterTempF: null,
  deviceSlot: null,
  chamberType: null,
}

const TELEMETRY_PATHS = [
  { key: 'opState', name: '/p/app/stat/id', type: 'uint8' as const },
  { key: 'heaterTempC', name: '/p/app/htr/temp', type: 'float32' as const },
  { key: 'batteryLevel', name: '/p/bat/cap', type: 'float32' as const },
  { key: 'batteryChargeState', name: '/p/bat/chg/stat', type: 'uint8' as const },
  { key: 'chamberType', name: '/p/htr/chmt', type: 'uint8' as const },
  { key: 'activeProfile', name: '/p/app/hcs', type: 'int8' as const },
]

function phaseFor(opState: unknown): SessionPhase {
  switch (opState) {
    case OPERATING_STATE.HEAT_CYCLE_PREHEAT:
      return 'preheat'
    case OPERATING_STATE.HEAT_CYCLE_ACTIVE:
      return 'active'
    case OPERATING_STATE.HEAT_CYCLE_FADE:
      return 'fade'
    case OPERATING_STATE.MASTER_OFF:
    case OPERATING_STATE.SLEEP:
      return 'off'
    default:
      return 'idle'
  }
}

function toPercent(level: unknown): number | null {
  if (typeof level !== 'number' || !Number.isFinite(level)) return null
  const pct = level <= 1 ? level * 100 : level
  return Math.max(0, Math.min(100, Math.round(pct)))
}

function messageOf(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

export function PuffcoProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [device, setDevice] = useState<PuffcoDevice | null>(null)
  const [slots, setSlots] = useState<ProfileDraft[]>(DEFAULT_SLOTS)
  const [animations, setAnimations] = useState<AnimationCatalog>(loadCatalog)
  const [busy, setBusy] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(OFFLINE_STATUS)
  const deviceRef = useRef<PuffcoDevice | null>(null)

  const bleSupported = isSupported()

  const rememberAnimations = useCallback((drafts: ProfileDraft[]) => {
    setAnimations((prev) => learnAnimations(prev, drafts.map((d) => d.color)))
  }, [])

  const loadSlots = useCallback(
    async (dev: PuffcoDevice) => {
      const loaded = await readAllSlots(dev)
      setSlots(loaded)
      rememberAnimations(loaded)
    },
    [rememberAnimations],
  )

  const attachDevice = useCallback(
    async (dev: PuffcoDevice) => {
      deviceRef.current = dev
      setDevice(dev)
      setStatus('connected')

      dev.ondisconnect = () => {
        deviceRef.current = null
        setDevice(null)
        setStatus('disconnected')
        setDeviceStatus(OFFLINE_STATUS)
      }

      try {
        await loadSlots(dev)
      } catch (e) {
        setLastError(messageOf(e, 'Failed to read profiles'))
      }
    },
    [loadSlots],
  )

  const connectDevice = useCallback(async () => {
    if (!bleSupported) {
      setLastError('Web Bluetooth is not available. Use Path Browser or Chrome over HTTPS.')
      return
    }
    setBusy(true)
    setLastError(null)
    setStatus('connecting')
    try {
      let dev: PuffcoDevice
      try {
        dev = await connectLastKnown()
      } catch (e) {
        if (!(e instanceof PuffcoDeviceNotFound)) throw e
        dev = await connect()
      }
      await attachDevice(dev)
    } catch (e) {
      setStatus('disconnected')
      if (e instanceof PuffcoUnsupportedBrowser) setLastError('This browser does not support Web Bluetooth.')
      else if (e instanceof PuffcoDeviceNotFound) setLastError('No device selected.')
      else setLastError(messageOf(e, 'Connection failed'))
    } finally {
      setBusy(false)
    }
  }, [attachDevice, bleSupported])

  const disconnectDevice = useCallback(() => {
    deviceRef.current?.disconnect()
    deviceRef.current = null
    setDevice(null)
    setStatus('disconnected')
    setDeviceStatus(OFFLINE_STATUS)
  }, [])

  const refreshSlots = useCallback(async () => {
    const dev = deviceRef.current
    if (!dev) return
    setBusy(true)
    try {
      await loadSlots(dev)
    } catch (e) {
      setLastError(messageOf(e, 'Read failed'))
    } finally {
      setBusy(false)
    }
  }, [loadSlots])

  const setDeviceSlot = useCallback((slot: ProfileSlot) => {
    setDeviceStatus((s) => ({ ...s, deviceSlot: slot }))
  }, [])

  const reportError = useCallback((message: string) => setLastError(message), [])
  const clearError = useCallback(() => setLastError(null), [])

  useEffect(() => {
    if (!device || status !== 'connected') return
    const ac = new AbortController()

    void (async () => {
      try {
        for await (const snap of device.telemetry.stream({
          intervalMs: 900,
          paths: TELEMETRY_PATHS,
          signal: ac.signal,
        })) {
          const heaterC = snap.heaterTempC
          const slot = snap.activeProfile
          const charge = snap.batteryChargeState
          setDeviceStatus((prev) => ({
            batteryPercent: toPercent(snap.batteryLevel) ?? prev.batteryPercent,
            charging: charge === 0 || charge === 1,
            phase: phaseFor(snap.opState),
            heaterTempF: typeof heaterC === 'number' ? Math.round(heaterC * 1.8 + 32) : null,
            deviceSlot:
              typeof slot === 'number' && slot >= 0 && slot <= 3 ? (slot as ProfileSlot) : prev.deviceSlot,
            chamberType: typeof snap.chamberType === 'number' ? snap.chamberType : prev.chamberType,
          }))
        }
      } catch {
        /* stream ends on disconnect */
      }
    })()

    return () => ac.abort()
  }, [device, status])

  const value = useMemo(
    () => ({
      bleSupported,
      status,
      device,
      deviceStatus,
      slots,
      setSlots,
      animations,
      rememberAnimations,
      connectDevice,
      disconnectDevice,
      refreshSlots,
      setDeviceSlot,
      busy,
      lastError,
      reportError,
      clearError,
    }),
    [
      bleSupported,
      status,
      device,
      deviceStatus,
      slots,
      animations,
      rememberAnimations,
      connectDevice,
      disconnectDevice,
      refreshSlots,
      setDeviceSlot,
      busy,
      lastError,
      reportError,
      clearError,
    ],
  )

  return <PuffcoContext.Provider value={value}>{children}</PuffcoContext.Provider>
}

export function usePuffco() {
  const ctx = useContext(PuffcoContext)
  if (!ctx) throw new Error('usePuffco must be used within PuffcoProvider')
  return ctx
}
