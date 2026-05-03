import { useState, useEffect, useCallback, useRef } from 'react'
import type { AppSettings, DayData, TimeBlock, NotificationActionType } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'
import { timeToMinutes, minutesToTime } from '../../shared/utils'
import { v4 as uuid } from 'uuid'
import { useUndo, type UndoAction } from './useUndo'

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function useAppState() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [currentDate, setCurrentDate] = useState(todayStr())
  const [dayData, setDayData] = useState<DayData>({
    date: currentDate,
    blocks: [],
    reviewed: false,
    completionRate: null,
  })
  const [todayData, setTodayData] = useState<DayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [now, setNow] = useState(new Date())

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoApi = useUndo()
  const dayCacheRef = useRef<Map<string, DayData>>(new Map())

  // Load settings on mount
  useEffect(() => {
    window.api.getSettings().then((s) => {
      setSettings(s)
      // Apply theme: dark is default (:root), light adds .light class
      document.documentElement.classList.toggle('light', s.theme === 'light')
    })
  }, [])

  // Load day data when date changes
  useEffect(() => {
    setLoading(true)
    window.api.getDayData(currentDate).then((data) => {
      setDayData(data)
      dayCacheRef.current.set(currentDate, data)
      if (currentDate === todayStr()) setTodayData(data)
      setLoading(false)
    })
  }, [currentDate])

  // Keep todayData in sync: if viewing today, mirror dayData; otherwise fetch on mount
  useEffect(() => {
    const today = todayStr()
    if (currentDate === today && dayData.date === today) {
      setTodayData(dayData)
    } else if (!todayData || todayData.date !== today) {
      void window.api.getDayData(today).then(setTodayData)
    }
  }, [currentDate, dayData, todayData])

  // Refresh today's data at midnight rollover
  useEffect(() => {
    const today = todayStr()
    if (todayData && todayData.date !== today) {
      void window.api.getDayData(today).then(setTodayData)
    }
  }, [todayData])

  // Update "now" every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Listen for quick-add global shortcut (dispatched from preload)
  useEffect(() => {
    const handler = () => setShowQuickAdd(true)
    window.addEventListener('koda:quickAdd', handler)
    return () => window.removeEventListener('koda:quickAdd', handler)
  }, [])

  // Debounced save
  const saveDayData = useCallback((data: DayData) => {
    setDayData(data)
    dayCacheRef.current.set(data.date, data)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      window.api.saveDayData(data)
    }, 500)
  }, [])

  // Save another day (not current). Bypasses local dayData replacement.
  const saveOtherDay = useCallback(async (data: DayData) => {
    dayCacheRef.current.set(data.date, data)
    await window.api.saveDayData(data)
  }, [])

  const saveSettingsAndApply = useCallback((s: AppSettings) => {
    setSettings(s)
    window.api.saveSettings(s)
    document.documentElement.classList.toggle('light', s.theme === 'light')
    window.api.setTheme(s.theme) // sync Electron window background
  }, [])

  // ── Block operations ──

  // Clamp time to timeline range
  const clampTime = useCallback((time: string): string => {
    const mins = timeToMinutes(time)
    const startMins = settings.timelineStart * 60
    const endMins = settings.timelineEnd * 60
    const clamped = Math.max(startMins, Math.min(mins, endMins))
    const h = Math.floor(clamped / 60)
    const m = clamped % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }, [settings.timelineStart, settings.timelineEnd])

  const addBlock = useCallback((block: Omit<TimeBlock, 'id' | 'completed'>) => {
    const start = clampTime(block.startTime)
    const end = clampTime(block.endTime)
    if (timeToMinutes(end) - timeToMinutes(start) < 15) return

    const newBlock: TimeBlock = { ...block, startTime: start, endTime: end, id: uuid(), completed: null }
    const updated = {
      ...dayData,
      blocks: [...dayData.blocks, newBlock].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      ),
    }
    saveDayData(updated)
    undoApi.push({ type: 'add', date: dayData.date, block: newBlock })
  }, [dayData, saveDayData, clampTime, undoApi])

  const updateBlock = useCallback((id: string, changes: Partial<TimeBlock>) => {
    const block = dayData.blocks.find(b => b.id === id)
    if (!block) return
    const merged = { ...block, ...changes }
    // Validate: end > start, minimum 15 min
    if (timeToMinutes(merged.endTime) - timeToMinutes(merged.startTime) < 15) return

    const updated = {
      ...dayData,
      blocks: dayData.blocks.map((b) =>
        b.id === id ? merged : b
      ).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }
    saveDayData(updated)
    undoApi.push({ type: 'update', date: dayData.date, before: block, after: merged })
  }, [dayData, saveDayData, undoApi])

  // Update without pushing to undo stack — used internally for live drag (we push once at end) or programmatic updates
  const updateBlockSilent = useCallback((id: string, changes: Partial<TimeBlock>) => {
    const block = dayData.blocks.find(b => b.id === id)
    if (!block) return
    const merged = { ...block, ...changes }
    if (timeToMinutes(merged.endTime) - timeToMinutes(merged.startTime) < 15) return

    const updated = {
      ...dayData,
      blocks: dayData.blocks.map((b) =>
        b.id === id ? merged : b
      ).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }
    saveDayData(updated)
  }, [dayData, saveDayData])

  const deleteBlock = useCallback((id: string) => {
    const block = dayData.blocks.find(b => b.id === id)
    if (!block) return
    const updated = {
      ...dayData,
      blocks: dayData.blocks.filter((b) => b.id !== id),
    }
    saveDayData(updated)
    undoApi.push({ type: 'delete', date: dayData.date, block })
  }, [dayData, saveDayData, undoApi])

  const deleteBlocks = useCallback((ids: string[]) => {
    const removed = dayData.blocks.filter(b => ids.includes(b.id))
    if (removed.length === 0) return
    const updated = {
      ...dayData,
      blocks: dayData.blocks.filter((b) => !ids.includes(b.id)),
    }
    saveDayData(updated)
    undoApi.push({ type: 'deleteMany', date: dayData.date, blocks: removed })
  }, [dayData, saveDayData, undoApi])

  const addBlocks = useCallback((blocks: Array<Omit<TimeBlock, 'id' | 'completed'>>) => {
    if (blocks.length === 0) return []
    const newBlocks: TimeBlock[] = blocks
      .map((b): TimeBlock | null => {
        const start = clampTime(b.startTime)
        const end = clampTime(b.endTime)
        if (timeToMinutes(end) - timeToMinutes(start) < 15) return null
        return { ...b, startTime: start, endTime: end, id: uuid(), completed: null }
      })
      .filter((b): b is TimeBlock => b !== null)
    if (newBlocks.length === 0) return []

    const updated = {
      ...dayData,
      blocks: [...dayData.blocks, ...newBlocks].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      ),
    }
    saveDayData(updated)
    undoApi.push({ type: 'addMany', date: dayData.date, blocks: newBlocks })
    return newBlocks.map(b => b.id)
  }, [dayData, saveDayData, clampTime, undoApi])

  // Bulk update (e.g. multi-select drag) — single undo entry
  const updateBlocksBulk = useCallback((updates: Array<{ id: string; changes: Partial<TimeBlock> }>) => {
    if (updates.length === 0) return
    const beforeMap = new Map<string, TimeBlock>()
    const afterMap = new Map<string, TimeBlock>()

    const newBlocks = dayData.blocks.map(b => {
      const u = updates.find(x => x.id === b.id)
      if (!u) return b
      const merged = { ...b, ...u.changes }
      if (timeToMinutes(merged.endTime) - timeToMinutes(merged.startTime) < 15) return b
      beforeMap.set(b.id, b)
      afterMap.set(b.id, merged)
      return merged
    }).sort((a, b) => a.startTime.localeCompare(b.startTime))

    const updated = { ...dayData, blocks: newBlocks }
    saveDayData(updated)
    // Don't push during live-drag; consumer will push manually after drag ends if needed.
  }, [dayData, saveDayData])

  // ── Undo / Redo execution ──

  // Apply an action's effect (used for redo)
  const applyAction = useCallback(async (action: UndoAction): Promise<string> => {
    const isCurrentDay = action.date === dayData.date

    const applyToDay = async (mutate: (d: DayData) => DayData) => {
      if (isCurrentDay) {
        const next = mutate(dayData)
        saveDayData(next)
      } else {
        const cached = dayCacheRef.current.get(action.date) ?? await window.api.getDayData(action.date)
        const next = mutate(cached)
        await saveOtherDay(next)
      }
    }

    switch (action.type) {
      case 'add': {
        await applyToDay(d => ({
          ...d,
          blocks: [...d.blocks, action.block].sort((a, b) => a.startTime.localeCompare(b.startTime)),
        }))
        return `Restored "${action.block.title}"`
      }
      case 'delete': {
        await applyToDay(d => ({ ...d, blocks: d.blocks.filter(b => b.id !== action.block.id) }))
        return `Removed "${action.block.title}"`
      }
      case 'update': {
        await applyToDay(d => ({
          ...d,
          blocks: d.blocks.map(b => b.id === action.after.id ? action.after : b)
            .sort((a, b) => a.startTime.localeCompare(b.startTime)),
        }))
        return `Updated "${action.after.title}"`
      }
      case 'addMany': {
        await applyToDay(d => ({
          ...d,
          blocks: [...d.blocks, ...action.blocks].sort((a, b) => a.startTime.localeCompare(b.startTime)),
        }))
        return `Added ${action.blocks.length} blocks`
      }
      case 'deleteMany': {
        const ids = new Set(action.blocks.map(b => b.id))
        await applyToDay(d => ({ ...d, blocks: d.blocks.filter(b => !ids.has(b.id)) }))
        return `Removed ${action.blocks.length} blocks`
      }
    }
  }, [dayData, saveDayData, saveOtherDay])

  // Reverse an action (used for undo)
  const reverseAction = useCallback(async (action: UndoAction): Promise<string> => {
    const isCurrentDay = action.date === dayData.date

    const applyToDay = async (mutate: (d: DayData) => DayData) => {
      if (isCurrentDay) {
        const next = mutate(dayData)
        saveDayData(next)
      } else {
        const cached = dayCacheRef.current.get(action.date) ?? await window.api.getDayData(action.date)
        const next = mutate(cached)
        await saveOtherDay(next)
      }
    }

    switch (action.type) {
      case 'add': {
        await applyToDay(d => ({ ...d, blocks: d.blocks.filter(b => b.id !== action.block.id) }))
        return `Undid: added "${action.block.title}"`
      }
      case 'delete': {
        await applyToDay(d => ({
          ...d,
          blocks: [...d.blocks, action.block].sort((a, b) => a.startTime.localeCompare(b.startTime)),
        }))
        return `Restored "${action.block.title}"`
      }
      case 'update': {
        await applyToDay(d => ({
          ...d,
          blocks: d.blocks.map(b => b.id === action.before.id ? action.before : b)
            .sort((a, b) => a.startTime.localeCompare(b.startTime)),
        }))
        return `Reverted "${action.before.title}"`
      }
      case 'addMany': {
        const ids = new Set(action.blocks.map(b => b.id))
        await applyToDay(d => ({ ...d, blocks: d.blocks.filter(b => !ids.has(b.id)) }))
        return `Undid: ${action.blocks.length} blocks`
      }
      case 'deleteMany': {
        await applyToDay(d => ({
          ...d,
          blocks: [...d.blocks, ...action.blocks].sort((a, b) => a.startTime.localeCompare(b.startTime)),
        }))
        return `Restored ${action.blocks.length} blocks`
      }
    }
  }, [dayData, saveDayData, saveOtherDay])

  // Apply a notification action button to today's block (the one the notification was about).
  const applyNotificationAction = useCallback(async (
    blockId: string,
    action: NotificationActionType
  ): Promise<{ message: string; color: string } | null> => {
    const today = todayStr()
    const isCurrentDay = today === currentDate
    const target = isCurrentDay
      ? dayData
      : (dayCacheRef.current.get(today) ?? await window.api.getDayData(today))

    const block = target.blocks.find(b => b.id === blockId)
    if (!block) return null

    let message = ''
    let color = '#22c55e'
    let nextBlock: TimeBlock = block

    if (action === 'done') {
      nextBlock = { ...block, completed: 'done' }
      message = `Marked "${block.title}" done`
    } else if (action === 'skip') {
      nextBlock = { ...block, completed: 'skipped' }
      color = '#64748b'
      message = `Skipped "${block.title}"`
    } else if (action === 'snooze') {
      // Snooze: extend the end time by 5 min, capped at 23:59
      const newEnd = Math.min(timeToMinutes('23:59'), timeToMinutes(block.endTime) + 5)
      nextBlock = { ...block, endTime: minutesToTime(newEnd) }
      color = '#f59e0b'
      message = `Snoozed "${block.title}" by 5 min`
    } else {
      return null
    }

    const updated: DayData = {
      ...target,
      blocks: target.blocks
        .map(b => b.id === blockId ? nextBlock : b)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }

    if (isCurrentDay) {
      saveDayData(updated)
    } else {
      await saveOtherDay(updated)
    }
    setTodayData(updated)
    return { message, color }
  }, [currentDate, dayData, saveDayData, saveOtherDay])

  const performUndo = useCallback(async (): Promise<{ message: string; date: string } | null> => {
    const action = undoApi.undo()
    if (!action) return null
    const message = await reverseAction(action)
    return { message, date: action.date }
  }, [undoApi, reverseAction])

  const performRedo = useCallback(async (): Promise<{ message: string; date: string } | null> => {
    const action = undoApi.redo()
    if (!action) return null
    const message = await applyAction(action)
    return { message, date: action.date }
  }, [undoApi, applyAction])

  // Navigation
  const goToDay = useCallback((offset: number) => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + offset)
    setCurrentDate(d.toISOString().split('T')[0])
  }, [currentDate])

  const goToToday = useCallback(() => {
    setCurrentDate(todayStr())
  }, [])

  const goToDate = useCallback((date: string) => {
    setCurrentDate(date)
  }, [])

  // Current block
  const getCurrentBlock = useCallback((): TimeBlock | null => {
    if (currentDate !== todayStr()) return null
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return dayData.blocks.find(
      (b) => b.startTime <= nowTime && b.endTime > nowTime
    ) ?? null
  }, [dayData.blocks, now, currentDate])

  const getNextBlock = useCallback((): TimeBlock | null => {
    if (currentDate !== todayStr()) return null
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return dayData.blocks.find((b) => b.startTime > nowTime) ?? null
  }, [dayData.blocks, now, currentDate])

  // Streak calculation
  const updateStreak = useCallback(() => {
    const today = todayStr()
    const s = { ...settings }
    if (s.lastActiveDate === today) return // already updated today

    if (s.lastActiveDate) {
      const last = new Date(s.lastActiveDate)
      const diff = Math.floor(
        (new Date(today).getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (diff === 1) {
        s.streak += 1
      } else if (diff > 1) {
        s.streak = 1
      }
    } else {
      s.streak = 1
    }

    s.lastActiveDate = today
    if (s.streak > s.bestStreak) s.bestStreak = s.streak
    saveSettingsAndApply(s)
  }, [settings, saveSettingsAndApply])

  return {
    settings,
    saveSettingsAndApply,
    currentDate,
    dayData,
    todayData,
    loading,
    now,
    applyNotificationAction,
    showQuickAdd,
    setShowQuickAdd,
    showReview,
    setShowReview,
    showSettings,
    setShowSettings,
    addBlock,
    addBlocks,
    updateBlock,
    updateBlockSilent,
    updateBlocksBulk,
    deleteBlock,
    deleteBlocks,
    goToDay,
    goToToday,
    goToDate,
    getCurrentBlock,
    getNextBlock,
    updateStreak,
    saveDayData,
    // Undo / Redo
    canUndo: undoApi.canUndo,
    canRedo: undoApi.canRedo,
    performUndo,
    performRedo,
  }
}
