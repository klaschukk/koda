import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import type { DayData, AppSettings } from '../../shared/types'
import { DEFAULT_SETTINGS, DEFAULT_CATEGORIES, IDEAL_DAY_TEMPLATE } from '../../shared/types'

// ── Paths ──

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'koda-data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getDaysDir(): string {
  const dir = path.join(getDataDir(), 'days')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getSettingsPath(): string {
  return path.join(getDataDir(), 'settings.json')
}

function getCorruptedDir(): string {
  // Holds files that failed to parse — kept around for manual recovery.
  const dir = path.join(getDataDir(), 'corrupted')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

// ── Atomic write (prevents corruption on crash mid-write) ──

function writeFileAtomic(target: string, content: string): void {
  const tmp = `${target}.tmp.${process.pid}`
  fs.writeFileSync(tmp, content, 'utf-8')
  fs.renameSync(tmp, target)
}

// ── Safe parse helpers ──

interface ParsedDay {
  ok: true
  data: DayData
}
interface ParseFailure {
  ok: false
  error: string
}

/**
 * Move a corrupted file out of the way so the app keeps booting.
 * Adds a timestamp suffix so recovering by hand is possible.
 */
function quarantineFile(filePath: string, reason: string): void {
  try {
    const name = path.basename(filePath)
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const target = path.join(getCorruptedDir(), `${name}.${ts}.bak`)
    fs.renameSync(filePath, target)
    // eslint-disable-next-line no-console
    console.warn(`[koda storage] Quarantined corrupted file ${name} (${reason}) → ${target}`)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[koda storage] Failed to quarantine ${filePath}:`, err)
  }
}

function parseDayFile(filePath: string): ParsedDay | ParseFailure {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as DayData
    // Sanity validation: must have date + blocks array
    if (!parsed || typeof parsed.date !== 'string' || !Array.isArray(parsed.blocks)) {
      return { ok: false, error: 'invalid shape' }
    }
    return { ok: true, data: parsed }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'parse error' }
  }
}

// ── Day Data ──

export function readDayData(date: string): DayData {
  const filePath = path.join(getDaysDir(), `${date}.json`)
  if (!fs.existsSync(filePath)) {
    return { date, blocks: [], reviewed: false, completionRate: null }
  }
  const result = parseDayFile(filePath)
  if (!result.ok) {
    quarantineFile(filePath, result.error)
    return { date, blocks: [], reviewed: false, completionRate: null }
  }
  return result.data
}

export function writeDayData(data: DayData): void {
  if (!data || !data.date) return
  try {
    const filePath = path.join(getDaysDir(), `${data.date}.json`)
    writeFileAtomic(filePath, JSON.stringify(data, null, 2))
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[koda storage] writeDayData failed:', err)
  }
}

// ── Settings ──

export function readSettings(): AppSettings {
  const filePath = getSettingsPath()
  let settings: AppSettings = { ...DEFAULT_SETTINGS }

  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        settings = { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch (err) {
      // settings.json corrupted — quarantine it and fall back to defaults so
      // the app still launches. User can restore from backup.
      quarantineFile(filePath, err instanceof Error ? err.message : 'parse error')
    }
  }

  // ── Migration: ensure Ideal Day template exists ──
  const tplIdx = settings.templates?.findIndex(t => t.id === IDEAL_DAY_TEMPLATE.id) ?? -1
  if (tplIdx === -1) {
    settings.templates = [...(settings.templates ?? []), IDEAL_DAY_TEMPLATE]
  }

  // ── Migration: ensure all categories required by the Ideal Day template exist ──
  // Adds any missing default category without touching the user's customized
  // ones. Safe to run on every launch.
  const existingIds = new Set(settings.categories?.map(c => c.id) ?? [])
  const missing = DEFAULT_CATEGORIES.filter(c => !existingIds.has(c.id))
  if (missing.length > 0) {
    settings.categories = [...(settings.categories ?? []), ...missing]
  }

  // ── Defensive: notifications object may be partial after migration ──
  if (!settings.notifications) {
    settings.notifications = { ...DEFAULT_SETTINGS.notifications }
  } else {
    settings.notifications = { ...DEFAULT_SETTINGS.notifications, ...settings.notifications }
  }
  if (!settings.pomodoro) {
    settings.pomodoro = { ...DEFAULT_SETTINGS.pomodoro }
  }

  return settings
}

export function writeSettings(settings: AppSettings): void {
  try {
    writeFileAtomic(getSettingsPath(), JSON.stringify(settings, null, 2))
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[koda storage] writeSettings failed:', err)
  }
}

// ── Week / Month / Range queries (resilient: skip bad files instead of crashing) ──

function readDirSafe(dir: string): string[] {
  try {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir).filter(f => f.endsWith('.json'))
  } catch {
    return []
  }
}

function readDaysFiltered(predicate: (file: string) => boolean): DayData[] {
  const dir = getDaysDir()
  const files = readDirSafe(dir).filter(predicate)
  const days: DayData[] = []
  for (const f of files) {
    const result = parseDayFile(path.join(dir, f))
    if (result.ok) {
      days.push(result.data)
    } else {
      quarantineFile(path.join(dir, f), result.error)
    }
  }
  return days.sort((a, b) => a.date.localeCompare(b.date))
}

export function readWeekData(startDate: string): DayData[] {
  const days: DayData[] = []
  const start = new Date(startDate)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    days.push(readDayData(dateStr))
  }
  return days
}

export function readMonthData(month: string): DayData[] {
  // month = "YYYY-MM"
  return readDaysFiltered(f => f.startsWith(month))
}

export function readRangeData(startDate: string, endDate: string): DayData[] {
  return readDaysFiltered(f => {
    const date = f.replace('.json', '')
    return date >= startDate && date <= endDate
  })
}

export function readAllDays(): DayData[] {
  return readDaysFiltered(() => true)
}

// ── Public path helpers ──

export function getDataPath(): string {
  return getDataDir()
}

/** Compute total bytes + days count for the data folder (recursive). */
export function getDataStats(): { bytes: number; daysCount: number } {
  const dir = getDataDir()
  let bytes = 0
  let daysCount = 0

  const walk = (p: string): void => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(p, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(p, e.name)
      if (e.isDirectory()) {
        walk(full)
      } else if (e.isFile()) {
        try {
          const st = fs.statSync(full)
          bytes += st.size
          if (full.includes(`${path.sep}days${path.sep}`) && e.name.endsWith('.json')) {
            daysCount++
          }
        } catch {
          // skip unreadable
        }
      }
    }
  }
  walk(dir)
  return { bytes, daysCount }
}

// ── Backup / Restore ──

export interface BackupData {
  version: 1
  exportedAt: string
  settings: AppSettings
  days: DayData[]
}

export function exportAllData(): BackupData {
  const days = readAllDays()
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: readSettings(),
    days,
  }
}

export interface ImportResult {
  daysImported: number
  daysOverwritten: number
  settingsImported: boolean
}

/**
 * Import a backup file. Strategy: 'merge' keeps existing days untouched,
 * 'overwrite' replaces them. Settings always merged with current.
 */
export function importBackup(
  backup: BackupData,
  strategy: 'merge' | 'overwrite' = 'merge'
): ImportResult {
  if (!backup || backup.version !== 1) {
    throw new Error('Invalid or unsupported backup format')
  }

  const dir = getDaysDir()
  let imported = 0
  let overwritten = 0

  for (const day of backup.days ?? []) {
    if (!day || typeof day.date !== 'string') continue
    const filePath = path.join(dir, `${day.date}.json`)
    const exists = fs.existsSync(filePath)
    if (exists && strategy === 'merge') continue
    try {
      writeFileAtomic(filePath, JSON.stringify(day, null, 2))
      if (exists) overwritten++
      else imported++
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[koda storage] Failed to import day ${day.date}:`, err)
    }
  }

  let settingsImported = false
  if (backup.settings) {
    try {
      const merged = { ...readSettings(), ...backup.settings }
      writeSettings(merged)
      settingsImported = true
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[koda storage] Failed to import settings:', err)
    }
  }

  return { daysImported: imported, daysOverwritten: overwritten, settingsImported }
}
