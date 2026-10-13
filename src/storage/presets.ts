import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { LampColorSchema, SavedPreset } from '../types/preset'
import { DEFAULT_BOOST_TEMP_F, DEFAULT_BOOST_TIME_S } from '../types/preset'
import { normalizeColorSchema } from '../ble/colors'

interface PeakLocalDB extends DBSchema {
  presets: {
    key: string
    value: SavedPreset
    indexes: { 'by-created': string }
  }
}

const DB_NAME = 'peak-local'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<PeakLocalDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<PeakLocalDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('presets', { keyPath: 'id' })
        store.createIndex('by-created', 'createdAt')
      },
    })
  }
  return dbPromise
}

function withDefaults(p: SavedPreset): SavedPreset {
  return {
    ...p,
    boostTempF: p.boostTempF ?? DEFAULT_BOOST_TEMP_F,
    boostTimeS: p.boostTimeS ?? DEFAULT_BOOST_TIME_S,
    vapor: p.vapor ?? null,
    favorite: p.favorite ?? false,
  }
}

export async function listPresets(): Promise<SavedPreset[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('presets', 'by-created')
  return all.reverse().map(withDefaults)
}

export async function savePreset(preset: SavedPreset): Promise<void> {
  const db = await getDb()
  await db.put('presets', preset)
}

export async function deletePreset(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('presets', id)
}

export async function toggleFavorite(id: string): Promise<void> {
  const db = await getDb()
  const existing = await db.get('presets', id)
  if (!existing) return
  await db.put('presets', { ...existing, favorite: !existing.favorite })
}

export async function duplicatePreset(id: string): Promise<SavedPreset | null> {
  const db = await getDb()
  const existing = await db.get('presets', id)
  if (!existing) return null
  const copy: SavedPreset = {
    ...structuredClone(existing),
    id: crypto.randomUUID(),
    name: `${existing.name} (copy)`.slice(0, 16),
    favorite: false,
    createdAt: new Date().toISOString(),
  }
  await db.put('presets', copy)
  return copy
}

function bytesReplacer(_key: string, value: unknown) {
  if (value instanceof Uint8Array) return { __bytes: Array.from(value) }
  return value
}

function bytesReviver(_key: string, value: unknown) {
  if (value && typeof value === 'object' && Array.isArray((value as { __bytes?: unknown }).__bytes)) {
    return Uint8Array.from((value as { __bytes: number[] }).__bytes)
  }
  return value
}

export async function exportPresetsJson(): Promise<string> {
  const presets = await listPresets()
  return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), presets }, bytesReplacer, 2)
}

export async function importPresetsJson(raw: string): Promise<number> {
  const parsed = JSON.parse(raw, bytesReviver) as { presets?: Partial<SavedPreset>[] }
  if (!Array.isArray(parsed.presets)) throw new Error('Invalid backup file')
  const db = await getDb()
  let count = 0
  for (const item of parsed.presets) {
    if (!item.id || !item.name) continue
    await db.put(
      'presets',
      withDefaults({
        id: item.id,
        name: String(item.name).slice(0, 16),
        tempF: Number(item.tempF) || 450,
        timeS: Number(item.timeS) || 40,
        boostTempF: Number(item.boostTempF ?? DEFAULT_BOOST_TEMP_F),
        boostTimeS: Number(item.boostTimeS ?? DEFAULT_BOOST_TIME_S),
        vapor: typeof item.vapor === 'number' ? item.vapor : null,
        color: normalizeColorSchema(item.color as LampColorSchema),
        favorite: Boolean(item.favorite),
        createdAt: item.createdAt || new Date().toISOString(),
        notes: item.notes,
      }),
    )
    count++
  }
  return count
}
