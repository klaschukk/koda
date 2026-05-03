import { useState, useCallback, useEffect } from 'react'
import { useAppState } from './hooks/useAppState'
import { useNotifications } from './hooks/useNotifications'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useTraySync } from './hooks/useTraySync'
import { IDEAL_DAY_TEMPLATE } from '../shared/types'
import NavBar, { type Page } from './components/NavBar'
import ToastContainer, { type ToastData } from './components/Toast'
import ShortcutsModal from './components/ShortcutsModal'
import Welcome from './components/Welcome'
import Dashboard from './pages/Dashboard'
import Planner from './pages/Planner'
import Calendar from './pages/Calendar'
import Stats from './pages/Stats'
import SettingsPage from './pages/SettingsPage'
import QuickAdd from './components/QuickAdd'
import DayReview from './components/DayReview'
import SearchBar from './components/SearchBar'

export default function App() {
  const state = useAppState()
  const [page, setPage] = useState<Page>('dashboard')
  const [toasts, setToasts] = useState<ToastData[]>([])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  const addToast = useCallback((event: ToastData) => {
    setToasts(prev => [...prev.slice(-4), event])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Smart notifications
  useNotifications({
    settings: state.settings,
    dayData: state.dayData,
    now: state.now,
    currentDate: state.currentDate,
    onNotification: addToast,
  })

  // Push tray state to main / popup whenever today's data, settings, or time tick changes
  useTraySync({
    settings: state.settings,
    todayData: state.todayData,
    now: state.now,
  })

  // Listen for action button clicks on native notifications
  useEffect(() => {
    const unsub = window.api.onNotificationAction(async (event) => {
      const result = await state.applyNotificationAction(event.blockId, event.action)
      if (result) {
        addToast({
          id: `act-${event.blockId}-${event.action}-${Date.now()}`,
          type: 'idle',
          title: result.message,
          body: '',
          color: result.color,
        })
      }
    })
    return unsub
  }, [state.applyNotificationAction, addToast])

  // Listen for tray "Review Day" / global menu requests
  useEffect(() => {
    const onReview = () => state.setShowReview(true)
    window.addEventListener('koda:openReview', onReview)
    return () => window.removeEventListener('koda:openReview', onReview)
  }, [state.setShowReview])

  // Generic notification helper for child components (Pomodoro, etc.)
  const notify = useCallback((title: string, body: string, color: string) => {
    addToast({
      id: `notify-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'idle',
      title, body, color,
    })
  }, [addToast])

  // Undo / redo with toast feedback
  const handleUndo = useCallback(async () => {
    if (!state.canUndo) return
    const result = await state.performUndo()
    if (!result) return
    addToast({
      id: `undo-${Date.now()}`,
      type: 'undo',
      title: result.message,
      body: result.date !== state.currentDate ? `On ${result.date}` : 'Press ⌘⇧Z to redo',
      color: 'var(--text-secondary)',
      action: state.canRedo
        ? {
            label: 'Redo',
            onClick: () => { void handleRedo() },
          }
        : undefined,
    })
  }, [state.canUndo, state.canRedo, state.performUndo, state.currentDate, addToast])

  const handleRedo = useCallback(async () => {
    if (!state.canRedo) return
    const result = await state.performRedo()
    if (!result) return
    addToast({
      id: `redo-${Date.now()}`,
      type: 'redo',
      title: result.message,
      body: result.date !== state.currentDate ? `On ${result.date}` : 'Press ⌘Z to undo',
      color: 'var(--text-secondary)',
    })
  }, [state.canRedo, state.performRedo, state.currentDate, addToast])

  // Apply a template to the current day
  const applyTemplate = useCallback((template: { name: string; blocks: Array<{ title: string; categoryId: string; startTime: string; endTime: string }> }) => {
    const ids = state.addBlocks(template.blocks)
    addToast({
      id: `tpl-${Date.now()}`,
      type: 'idle',
      title: `Applied "${template.name}"`,
      body: `${ids.length} block${ids.length === 1 ? '' : 's'} added`,
      color: 'var(--success)',
    })
  }, [state.addBlocks, addToast])

  // Load Ideal Day template (one-click button in Sidebar/Dashboard)
  // Falls back to the seeded constant if user accidentally deleted it.
  const loadIdealDay = useCallback(() => {
    const tpl = state.settings.templates?.find(t => t.id === IDEAL_DAY_TEMPLATE.id) ?? IDEAL_DAY_TEMPLATE
    applyTemplate(tpl)
  }, [state.settings.templates, applyTemplate])

  // Update freeform daily note (saved as part of DayData)
  const updateDayNote = useCallback((note: string) => {
    state.saveDayData({ ...state.dayData, note: note.trim() ? note.trim() : undefined })
  }, [state.dayData, state.saveDayData])

  // Mark currently active block as done (D key shortcut)
  const markCurrentDone = useCallback(() => {
    const current = state.getCurrentBlock?.()
    if (!current) return
    state.updateBlock(current.id, { completed: 'done' })
    addToast({
      id: `done-${current.id}-${Date.now()}`,
      type: 'block-starting',
      title: 'Marked as done',
      body: current.title,
      color: 'var(--success)',
    })
  }, [state, addToast])

  // Search → navigate to date and close
  const handleSearchSelect = useCallback((date: string, _blockId: string) => {
    state.goToDate(date)
    setPage('planner')
    setShowSearch(false)
  }, [state.goToDate])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onQuickAdd: () => state.setShowQuickAdd(true),
    onShowShortcuts: () => setShowShortcuts(true),
    onGoToToday: () => state.goToToday(),
    onPrevDay: () => state.goToDay(-1),
    onNextDay: () => state.goToDay(1),
    onNavigateDashboard: () => setPage('dashboard'),
    onNavigatePlanner: () => setPage('planner'),
    onNavigateCalendar: () => setPage('calendar'),
    onNavigateStats: () => setPage('stats'),
    onNavigateSettings: () => setPage('settings'),
    onOpenReview: () => state.setShowReview(true),
    onUndo: handleUndo,
    onRedo: handleRedo,
    onSearch: () => setShowSearch(true),
    onMarkCurrentDone: markCurrentDone,
    onCloseModal: () => {
      if (showSearch) setShowSearch(false)
      else if (showShortcuts) setShowShortcuts(false)
      else if (state.showQuickAdd) state.setShowQuickAdd(false)
      else if (state.showReview) state.setShowReview(false)
    },
  }, !state.loading)

  // Bridge native menu events to UI actions
  useEffect(() => {
    const onQuickAdd = () => state.setShowQuickAdd(true)
    const onReview = () => state.setShowReview(true)
    const onShortcuts = () => setShowShortcuts(true)
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent).detail as unknown[]
      const target = detail?.[0] as Page
      if (target) setPage(target)
    }
    const onToday = () => state.goToToday()
    const onDay = (e: Event) => {
      const detail = (e as CustomEvent).detail as unknown[]
      const offset = detail?.[0] as number
      if (typeof offset === 'number') state.goToDay(offset)
    }
    const onExport = async () => {
      const result = await window.api.exportData()
      if (result.success) {
        addToast({
          id: `export-${Date.now()}`,
          type: 'idle',
          title: 'Backup created',
          body: `${result.daysCount ?? 0} day${result.daysCount === 1 ? '' : 's'} exported`,
          color: '#22c55e',
        })
      } else if (!result.canceled) {
        addToast({
          id: `export-err-${Date.now()}`,
          type: 'block-overtime',
          title: 'Export failed',
          body: result.error ?? 'Unknown error',
          color: '#ef4444',
        })
      }
    }
    const onImport = async () => {
      const result = await window.api.importData()
      if (result.success) {
        addToast({
          id: `import-${Date.now()}`,
          type: 'idle',
          title: 'Backup restored',
          body: `${result.daysImported ?? 0} new · ${result.daysOverwritten ?? 0} overwritten`,
          color: '#22c55e',
        })
        // Reload current day data
        window.api.getDayData(state.currentDate).then((d) => state.saveDayData(d))
        window.api.getSettings().then((s) => state.saveSettingsAndApply(s))
      } else if (!result.canceled) {
        addToast({
          id: `import-err-${Date.now()}`,
          type: 'block-overtime',
          title: 'Import failed',
          body: result.error ?? 'Unknown error',
          color: '#ef4444',
        })
      }
    }
    const onOpenFolder = () => { void window.api.openDataFolder() }

    window.addEventListener('koda:menu:quickAdd', onQuickAdd)
    window.addEventListener('koda:menu:review', onReview)
    window.addEventListener('koda:menu:shortcuts', onShortcuts)
    window.addEventListener('koda:menu:navigate', onNav as EventListener)
    window.addEventListener('koda:menu:goToToday', onToday)
    window.addEventListener('koda:menu:goToDay', onDay as EventListener)
    window.addEventListener('koda:menu:exportData', onExport)
    window.addEventListener('koda:menu:importData', onImport)
    window.addEventListener('koda:menu:openDataFolder', onOpenFolder)
    return () => {
      window.removeEventListener('koda:menu:quickAdd', onQuickAdd)
      window.removeEventListener('koda:menu:review', onReview)
      window.removeEventListener('koda:menu:shortcuts', onShortcuts)
      window.removeEventListener('koda:menu:navigate', onNav as EventListener)
      window.removeEventListener('koda:menu:goToToday', onToday)
      window.removeEventListener('koda:menu:goToDay', onDay as EventListener)
      window.removeEventListener('koda:menu:exportData', onExport)
      window.removeEventListener('koda:menu:importData', onImport)
      window.removeEventListener('koda:menu:openDataFolder', onOpenFolder)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Show welcome screen on first launch
  const isFirstLaunch = !state.loading && state.settings.lastActiveDate === null

  if (isFirstLaunch) {
    return (
      <Welcome
        settings={state.settings}
        onComplete={(s) => {
          state.saveSettingsAndApply(s)
        }}
      />
    )
  }

  if (state.loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black"
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              color: 'white',
              boxShadow: '0 4px 24px rgba(99, 102, 241, 0.3)',
            }}
          >
            K
          </div>
          <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        </div>
      </div>
    )
  }

  const currentBlock = state.getCurrentBlock()
  const nextBlock = state.getNextBlock()

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Drag region */}
      <div className="drag-region flex-shrink-0" />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <NavBar
          activePage={page}
          onNavigate={setPage}
          streak={state.settings.streak}
        />

        {page === 'dashboard' && (
          <Dashboard
            settings={state.settings}
            dayData={state.dayData}
            now={state.now}
            currentBlock={currentBlock}
            nextBlock={nextBlock}
            onNavigateToPlanner={() => setPage('planner')}
            onOpenQuickAdd={() => state.setShowQuickAdd(true)}
            onOpenReview={() => state.setShowReview(true)}
            onLoadIdealDay={loadIdealDay}
            onUpdateDayNote={updateDayNote}
          />
        )}

        {page === 'planner' && (
          <Planner
            settings={state.settings}
            dayData={state.dayData}
            currentDate={state.currentDate}
            now={state.now}
            currentBlock={currentBlock}
            nextBlock={nextBlock}
            onGoToDay={state.goToDay}
            onGoToToday={state.goToToday}
            onAddBlock={state.addBlock}
            onUpdateBlock={state.updateBlock}
            onUpdateBlockSilent={state.updateBlockSilent}
            onUpdateBlocksBulk={state.updateBlocksBulk}
            onDeleteBlock={state.deleteBlock}
            onDeleteBlocks={state.deleteBlocks}
            onOpenQuickAdd={() => state.setShowQuickAdd(true)}
            onOpenReview={() => state.setShowReview(true)}
            onOpenSettings={() => setPage('settings')}
            onLoadIdealDay={loadIdealDay}
            onNotify={notify}
          />
        )}

        {page === 'calendar' && (
          <Calendar
            settings={state.settings}
            currentDate={state.currentDate}
            onSelectDate={(date) => {
              const today = new Date().toISOString().split('T')[0]
              const diff = Math.round(
                (new Date(date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
              )
              const currentDiff = Math.round(
                (new Date(state.currentDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
              )
              state.goToDay(diff - currentDiff)
            }}
            onNavigateToPlanner={() => setPage('planner')}
          />
        )}

        {page === 'stats' && <Stats settings={state.settings} />}

        {page === 'settings' && (
          <SettingsPage
            settings={state.settings}
            onSave={state.saveSettingsAndApply}
          />
        )}
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Shortcuts cheat sheet */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {/* Search */}
      {showSearch && (
        <SearchBar
          settings={state.settings}
          onClose={() => setShowSearch(false)}
          onSelect={handleSearchSelect}
        />
      )}

      {/* Modals */}
      {state.showQuickAdd && (
        <QuickAdd
          settings={state.settings}
          onAdd={state.addBlock}
          onApplyTemplate={applyTemplate}
          onClose={() => state.setShowQuickAdd(false)}
        />
      )}
      {state.showReview && (
        <DayReview
          dayData={state.dayData}
          settings={state.settings}
          onSave={(data) => {
            state.saveDayData(data)
            state.updateStreak()
          }}
          onClose={() => state.setShowReview(false)}
        />
      )}
    </div>
  )
}
