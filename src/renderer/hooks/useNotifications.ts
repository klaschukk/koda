import { useEffect, useRef, useCallback } from 'react'
import type { AppSettings, DayData } from '../../shared/types'
import { timeToMinutes } from '../../shared/utils'

interface NotificationEvent {
  id: string
  type: 'block-starting' | 'block-ending' | 'block-overtime' | 'idle'
  title: string
  body: string
  color: string
  blockId?: string
}

interface Props {
  settings: AppSettings
  dayData: DayData
  now: Date
  currentDate: string
  onNotification: (event: NotificationEvent) => void
}

export function useNotifications({ settings, dayData, now, currentDate, onNotification }: Props) {
  const firedRef = useRef<Set<string>>(new Set())
  const isToday = currentDate === new Date().toISOString().split('T')[0]

  // Reset fired notifications when date changes
  useEffect(() => {
    firedRef.current.clear()
  }, [currentDate])

  const fire = useCallback(
    (event: NotificationEvent, subtitle?: string) => {
      if (firedRef.current.has(event.id)) return
      firedRef.current.add(event.id)
      if (!settings.notifications.enabled) return
      onNotification(event)

      // Native OS notification — actions on block-related events only
      const withActions = event.type !== 'idle'
      void window.api.showNotification({
        title: event.title,
        body: event.body,
        subtitle,
        blockId: event.blockId,
        soundPack: settings.notifications.sound ? settings.notifications.soundPack : 'none',
        silent: !settings.notifications.sound,
        withActions,
      })
    },
    [onNotification, settings.notifications]
  )

  useEffect(() => {
    if (!isToday) return
    if (!settings.notifications.enabled) return

    const nowMins = now.getHours() * 60 + now.getMinutes()

    for (const block of dayData.blocks) {
      const startMins = timeToMinutes(block.startTime)
      const endMins = timeToMinutes(block.endTime)
      const cat = settings.categories.find(c => c.id === block.categoryId)
      const color = cat?.color ?? '#64748b'
      const name = cat?.name ?? 'Block'

      const timeRange = `${block.startTime} → ${block.endTime}`

      if (settings.notifications.blockStart && nowMins === startMins) {
        fire({
          id: `start-${block.id}-${block.startTime}`,
          type: 'block-starting',
          title: `${name} starts now`,
          body: `${block.title} — ${timeRange}`,
          color,
          blockId: block.id,
        }, timeRange)
      }

      if (settings.notifications.blockEnding && nowMins === endMins - 5 && endMins - startMins > 10) {
        const nextBlock = dayData.blocks.find(b => timeToMinutes(b.startTime) >= endMins)
        const nextCat = nextBlock ? settings.categories.find(c => c.id === nextBlock.categoryId) : null
        fire({
          id: `ending-${block.id}-${block.endTime}`,
          type: 'block-ending',
          title: `${name} ends in 5 min`,
          body: nextBlock ? `Next: ${nextCat?.name ?? ''} — ${nextBlock.title}` : 'Free time after this',
          color,
          blockId: block.id,
        }, timeRange)
      }

      if (settings.notifications.overtime && nowMins === endMins + 10) {
        fire({
          id: `overtime-${block.id}`,
          type: 'block-overtime',
          title: `${name} — overtime`,
          body: `${block.title} ended 10 min ago`,
          color,
          blockId: block.id,
        }, timeRange)
      }
    }

    if (settings.notifications.idle) {
      const hasCurrentBlock = dayData.blocks.some(b =>
        timeToMinutes(b.startTime) <= nowMins && timeToMinutes(b.endTime) > nowMins
      )
      if (!hasCurrentBlock && dayData.blocks.length > 0 && nowMins >= timeToMinutes(dayData.blocks[0].startTime)) {
        const lastEnd = dayData.blocks.reduce((max, b) => {
          const e = timeToMinutes(b.endTime)
          return e <= nowMins && e > max ? e : max
        }, 0)
        if (lastEnd > 0 && nowMins - lastEnd === 30) {
          fire({
            id: `idle-${lastEnd}`,
            type: 'idle',
            title: '30 min without activity',
            body: 'Free time — add a block?',
            color: '#38bdf8',
          })
        }
      }
    }
  }, [now, isToday, dayData.blocks, settings.categories, settings.notifications, fire])
}
