import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import type { DayData, AppSettings } from '../../shared/types'
import { DEFAULT_SETTINGS, DEFAULT_CATEGORIES, IDEAL_DAY_TEMPLATE } from '../../shared/types'

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

// ── Day Data ──

export function readDayData(date: string): DayData {
  const filePath = path.join(getDaysDir(), `${date}.json`)
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  }
  return { date, blocks: [], reviewed: false, completionRate: null }
}

export function writeDayData(data: DayData): void {
  const filePath = path.join(getDaysDir(), `${data.date}.json`)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// ── Settings ──

export function readSettings(): AppSettings {
  const filePath = getSettingsPath()
  let settings: AppSettings
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf-8')
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } else {
    settings = { ...DEFAULT_SETTINGS }
  }

  // ── Migration: ensure Ideal Day template exists ──
  const tplIdx = settings.templates?.findIndex(t => t.id === IDEAL_DAY_TEMPLATE.id) ?? -1
  if (tplIdx === -1) {
    settings.templates = [...(settings.templates ?? []), IDEAL_DAY_TEMPLATE]
  }

  // ── Migration: ensure all categories required by the Ideal Day template exist ──
  // Adds any missing default category (e.g. morning, music, it, youtube, home,
  // free, sleep) without touching the user's customized categories.
  const existingIds = new Set(settings.categories?.map(c => c.id) ?? [])
  const missing = DEFAULT_CATEGORIES.filter(c => !existingIds.has(c.id))
  if (missing.length > 0) {
    settings.categories = [...(settings.categories ?? []), ...missing]
  }

  return settings
}

export function writeSettings(settings: AppSettings): void {
  const filePath = getSettingsPath()
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8')
}

// ── Week / Month queries ──

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
  const dir = getDaysDir()
  if (!fs.existsSync(dir)) return []
  const files = fs.readdirSync(dir).filter(f => f.startsWith(month) && f.endsWith('.json'))
  return files.map(f => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8')
    return JSON.parse(raw) as DayData
  }).sort((a, b) => a.date.localeCompare(b.date))
}

export function readRangeData(startDate: string, endDate: string): DayData[] {
  const dir = getDaysDir()
  if (!fs.existsSync(dir)) return []
  const files = fs.readdirSync(dir).filter(f => {
    if (!f.endsWith('.json')) return false
    const date = f.replace('.json', '')
    return date >= startDate && date <= endDate
  })
  return files.map(f => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8')
    return JSON.parse(raw) as DayData
  }).sort((a, b) => a.date.localeCompare(b.date))
}

export function readAllDays(): DayData[] {
  const dir = getDaysDir()
  if (!fs.existsSync(dir)) return []
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
  return files.map(f => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8')
    return JSON.parse(raw) as DayData
  }).sort((a, b) => a.date.localeCompare(b.date))
}

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
  const dir = getDaysDir()
  const days: DayData[] = []
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
        days.push(JSON.parse(raw))
      } catch {
        // skip corrupted file
      }
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: readSettings(),
    days: days.sort((a, b) => a.date.localeCompare(b.date)),
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
    if (!day.date) continue
    const filePath = path.join(dir, `${day.date}.json`)
    const exists = fs.existsSync(filePath)
    if (exists && strategy === 'merge') continue
    fs.writeFileSync(filePath, JSON.stringify(day, null, 2), 'utf-8')
    if (exists) overwritten++
    else imported++
  }

  let settingsImported = false
  if (backup.settings) {
    const merged = { ...readSettings(), ...backup.settings }
    writeSettings(merged)
    settingsImported = true
  }

  return { daysImported: imported, daysOverwritten: overwritten, settingsImported }
}
