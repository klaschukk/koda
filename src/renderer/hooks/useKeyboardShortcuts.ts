import { useEffect } from 'react'

export interface ShortcutHandlers {
  onQuickAdd?: () => void
  onShowShortcuts?: () => void
  onGoToToday?: () => void
  onPrevDay?: () => void
  onNextDay?: () => void
  onNavigateDashboard?: () => void
  onNavigatePlanner?: () => void
  onNavigateCalendar?: () => void
  onNavigateStats?: () => void
  onNavigateSettings?: () => void
  onOpenReview?: () => void
  onCloseModal?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onSearch?: () => void
  onMarkCurrentDone?: () => void
}

export interface ShortcutDef {
  keys: string
  label: string
  group: 'navigation' | 'actions' | 'general' | 'editing'
}

export const SHORTCUTS: ShortcutDef[] = [
  { keys: '⌘K',       label: 'Quick Add Block',  group: 'actions' },
  { keys: '⌘N',       label: 'New Block',        group: 'actions' },
  { keys: '⌘R',       label: 'Review Day',       group: 'actions' },
  { keys: '⌘F',       label: 'Search Blocks',    group: 'actions' },
  { keys: 'D',        label: 'Mark current done', group: 'actions' },
  { keys: '⌘Z',       label: 'Undo',             group: 'editing' },
  { keys: '⌘⇧Z',      label: 'Redo',             group: 'editing' },
  { keys: '?',        label: 'Show Shortcuts',   group: 'general' },
  { keys: 'Esc',      label: 'Close Modal',      group: 'general' },
  { keys: '⌘1',       label: 'Dashboard',        group: 'navigation' },
  { keys: '⌘2',       label: 'Planner',          group: 'navigation' },
  { keys: '⌘3',       label: 'Calendar',         group: 'navigation' },
  { keys: '⌘4',       label: 'Stats',            group: 'navigation' },
  { keys: '⌘,',       label: 'Settings',         group: 'navigation' },
  { keys: 'T',        label: 'Jump to Today',    group: 'navigation' },
  { keys: '←',        label: 'Previous Day',     group: 'navigation' },
  { keys: '→',        label: 'Next Day',         group: 'navigation' },
  { keys: 'Drag',     label: 'Drag-create block', group: 'editing' },
  { keys: '⌘ Click',  label: 'Multi-select',     group: 'editing' },
  { keys: '⇧ Click',  label: 'Range select',     group: 'editing' },
]

export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      const meta = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      // Always allow Esc
      if (e.key === 'Escape') {
        handlers.onCloseModal?.()
        return
      }

      // Cmd+Z / Cmd+Shift+Z work even when typing — but typically users expect them
      // to apply to the surrounding app context, not the input. We'll only allow when
      // not typing, so as not to conflict with native input undo/redo.
      if (meta && key === 'z' && !isTyping) {
        e.preventDefault()
        if (e.shiftKey) handlers.onRedo?.()
        else handlers.onUndo?.()
        return
      }

      // Cmd+F: search — works even when typing (replaces native find which we don't have)
      if (meta && key === 'f' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        handlers.onSearch?.()
        return
      }

      // Skip if typing (except for explicit meta+key handled above)
      if (isTyping && !meta) return

      // Cmd combos
      if (meta && !e.shiftKey && !e.altKey) {
        switch (key) {
          case 'k':
            e.preventDefault()
            handlers.onQuickAdd?.()
            return
          case 'n':
            e.preventDefault()
            handlers.onQuickAdd?.()
            return
          case 'r':
            e.preventDefault()
            handlers.onOpenReview?.()
            return
          case '1':
            e.preventDefault()
            handlers.onNavigateDashboard?.()
            return
          case '2':
            e.preventDefault()
            handlers.onNavigatePlanner?.()
            return
          case '3':
            e.preventDefault()
            handlers.onNavigateCalendar?.()
            return
          case '4':
            e.preventDefault()
            handlers.onNavigateStats?.()
            return
          case ',':
            e.preventDefault()
            handlers.onNavigateSettings?.()
            return
        }
      }

      // Single keys (not while typing)
      if (!meta && !e.shiftKey && !e.altKey && !isTyping) {
        switch (key) {
          case '?':
          case '/':
            if (e.shiftKey || key === '?') {
              e.preventDefault()
              handlers.onShowShortcuts?.()
            }
            return
          case 't':
            e.preventDefault()
            handlers.onGoToToday?.()
            return
          case 'arrowleft':
            handlers.onPrevDay?.()
            return
          case 'arrowright':
            handlers.onNextDay?.()
            return
          case 'd':
            e.preventDefault()
            handlers.onMarkCurrentDone?.()
            return
        }
      }

      // Shift + ?
      if (e.shiftKey && (key === '/' || key === '?')) {
        e.preventDefault()
        handlers.onShowShortcuts?.()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handlers, enabled])
}
