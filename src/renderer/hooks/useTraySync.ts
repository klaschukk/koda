import { useEffect, useRef } from 'react'
import type { AppSettings, DayData, TrayState } from '../../shared/types'
import { timeToMinutes } from '../../shared/utils'

interface Props {
  settings: AppSettings
  /** Today's day data (must be today, not the currently-viewed day). */
  todayData: DayData | null
  now: Date
}

function computeState(settings: AppSettings, todayData: DayData | null, now: Date): TrayState {
  const today = new Date().toISOString().split('T')[0]
  const data = todayData ?? { date: today, blocks: [], reviewed: false, completionRate: null }
  const nowMins = now.getHours() * 60 + now.getMinutes()

  const sorted = [...data.blocks].sort((a, b) => a.startTime.localeCompare(b.startTime))
  const current = sorted.find(b => timeToMinutes(b.startTime) <= nowMins && timeToMinutes(b.endTime) > nowMins) ?? null
  const upcoming = sorted.filter(b => timeToMinutes(b.startTime) > nowMins).slice(0, 2)

  // Totals
  let plannedMins = 0
  let completedMins = 0
  let blocksDone = 0
  for (const b of sorted) {
    const dur = timeToMinutes(b.endTime) - timeToMinutes(b.startTime)
    plannedMins += dur
    if (b.completed === 'done') {
      completedMins += dur
      blocksDone += 1
    } else if (b.completed === 'partial') {
      completedMins += Math.round(dur / 2)
      blocksDone += 1
    }
  }
  const blocksTotal = sorted.length
  const blocksRemaining = sorted.filter(
    b => b.completed !== 'done' && b.completed !== 'skipped' && timeToMinutes(b.endTime) > nowMins
  ).length
  const completionPct = plannedMins > 0 ? Math.round((completedMins / plannedMins) * 100) : 0

  const lookupCat = (id: string) =>
    settings.categories.find(c => c.id === id) ?? { name: 'Block', color: '#64748b', icon: '\u{1F4CC}', id: '' }

  let curOut: TrayState['current'] = null
  if (current) {
    const cat = lookupCat(current.categoryId)
    const remainingMins = Math.max(0, timeToMinutes(current.endTime) - nowMins)
    const total = timeToMinutes(current.endTime) - timeToMinutes(current.startTime)
    const progress = total > 0 ? Math.min(1, Math.max(0, (nowMins - timeToMinutes(current.startTime)) / total)) : 0
    curOut = {
      blockId: current.id,
      title: current.title,
      categoryName: cat.name,
      categoryColor: cat.color,
      categoryIcon: cat.icon,
      startTime: current.startTime,
      endTime: current.endTime,
      remainingMins,
      progress,
    }
  }

  return {
    date: today,
    current: curOut,
    upcoming: upcoming.map(b => {
      const cat = lookupCat(b.categoryId)
      return {
        blockId: b.id,
        title: b.title,
        categoryName: cat.name,
        categoryColor: cat.color,
        categoryIcon: cat.icon,
        startTime: b.startTime,
        endTime: b.endTime,
      }
    }),
    totals: {
      plannedMins,
      completedMins,
      completionPct,
      blocksTotal,
      blocksDone,
      blocksRemaining,
    },
    streak: settings.streak,
    theme: settings.theme,
  }
}

/**
 * Compute tray state from the latest app data and push it to the main process.
 * Also responds to "trayRequestState" pings from the popup window.
 */
export function useTraySync({ settings, todayData, now }: Props) {
  const lastSerializedRef = useRef<string>('')

  useEffect(() => {
    const state = computeState(settings, todayData, now)
    const ser = JSON.stringify(state)
    if (ser === lastSerializedRef.current) return
    lastSerializedRef.current = ser
    void window.api.pushTrayState(state)
  }, [settings, todayData, now])

  // Respond to popup-open requests with a fresh push
  useEffect(() => {
    const handler = () => {
      const state = computeState(settings, todayData, now)
      lastSerializedRef.current = JSON.stringify(state)
      void window.api.pushTrayState(state)
    }
    window.addEventListener('koda:trayRequestState', handler)
    return () => window.removeEventListener('koda:trayRequestState', handler)
  }, [settings, todayData, now])
}
