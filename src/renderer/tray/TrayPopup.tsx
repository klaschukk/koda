import React, { useEffect, useState } from 'react'
import { Coffee, Plus, ExternalLink, ClipboardCheck, Flame, ArrowRight } from 'lucide-react'
import type { TrayState } from '../../shared/types'
import { formatCountdown, formatDuration } from '../../shared/utils'

export default function TrayPopup() {
  const [state, setState] = useState<TrayState | null>(null)

  useEffect(() => {
    // Subscribe to state pushes from main
    const unsub = window.api.onTrayState(s => setState(s))
    // Ask the main app to push fresh state (covers initial-open before App finishes mounting)
    void window.api.trayRequestState()
    return unsub
  }, [])

  // Apply theme from incoming state
  useEffect(() => {
    if (!state) return
    document.documentElement.classList.toggle('light', state.theme === 'light')
  }, [state?.theme])

  // Re-tick countdown every 30s while popup is open (the main process also pushes per-minute)
  useEffect(() => {
    const t = setInterval(() => setState(prev => prev ? { ...prev } : prev), 30_000)
    return () => clearInterval(t)
  }, [])

  if (!state) {
    return (
      <div className="tray-shell">
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black"
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              color: 'white',
            }}
          >
            K
          </div>
        </div>
      </div>
    )
  }

  const cur = state.current
  const hasUpcoming = state.upcoming.length > 0

  return (
    <div className="tray-shell animate-fade-in">
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black"
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              color: 'white',
            }}
          >
            K
          </div>
          <div>
            <div className="text-[12px] font-bold leading-tight" style={{ color: 'var(--text)' }}>
              Koda
            </div>
            <div className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
        {state.streak > 0 && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{
              background: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
            }}
          >
            <Flame size={11} style={{ color: 'var(--secondary)' }} />
            <span className="text-[10px] font-bold" style={{ color: 'var(--secondary)' }}>
              {state.streak}
            </span>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Current block */}
        <div className="kd-label">Now</div>
        {cur ? (
          <div
            className="rounded-xl p-3.5"
            style={{
              background: `${cur.categoryColor}0d`,
              border: `1px solid ${cur.categoryColor}38`,
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: '14px', lineHeight: 1 }}>{cur.categoryIcon}</span>
                <span className="text-[12px] font-bold" style={{ color: cur.categoryColor }}>
                  {cur.categoryName}
                </span>
              </div>
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                {cur.startTime} → {cur.endTime}
              </span>
            </div>
            <div className="text-[12px] font-medium mb-2 truncate" style={{ color: 'var(--text)' }}>
              {cur.title}
            </div>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span
                className="font-mono tabular-nums text-[20px] font-black"
                style={{ color: cur.categoryColor }}
              >
                {formatCountdown(cur.remainingMins)}
              </span>
              <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
                remaining
              </span>
            </div>
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{ background: `${cur.categoryColor}1f` }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(cur.progress * 100)}%`,
                  background: cur.categoryColor,
                  transition: 'width 1s ease-out',
                }}
              />
            </div>
          </div>
        ) : (
          <div className="kd-card rounded-xl p-4 text-center">
            <Coffee size={20} className="mx-auto mb-1.5" style={{ color: 'var(--text-muted)' }} />
            <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
              Free time
            </div>
          </div>
        )}

        {/* Upcoming */}
        {hasUpcoming && (
          <>
            <div className="kd-label">Up Next</div>
            <div className="space-y-1.5">
              {state.upcoming.slice(0, 2).map(b => (
                <div
                  key={b.blockId}
                  className="rounded-lg p-2.5"
                  style={{
                    background: `${b.categoryColor}08`,
                    border: `1px solid ${b.categoryColor}1f`,
                  }}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <ArrowRight size={10} style={{ color: b.categoryColor }} />
                      <span className="text-[10px] font-semibold" style={{ color: b.categoryColor }}>
                        {b.categoryName}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {b.startTime}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium truncate" style={{ color: 'var(--text)' }}>
                    {b.title}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Daily progress */}
        <div className="kd-label">Today</div>
        <div className="kd-card rounded-xl p-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Completion
            </span>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--primary-light)' }}>
              {state.totals.completionPct}%
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--elevated)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${state.totals.completionPct}%`,
                background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                transition: 'width var(--transition-slow)',
              }}
            />
          </div>
          <div
            className="flex items-center justify-between mt-2 text-[10px]"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>
              {state.totals.blocksDone}/{state.totals.blocksTotal} blocks
            </span>
            <span className="font-mono">
              {formatDuration(state.totals.completedMins)} / {formatDuration(state.totals.plannedMins)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div
        className="px-3 py-2.5 border-t flex items-center gap-1.5"
        style={{ borderColor: 'var(--border)', background: 'var(--elevated)' }}
      >
        <button
          type="button"
          onClick={() => { void window.api.trayOpenQuickAdd() }}
          className="kd-btn kd-btn-primary flex-1 text-[11px] h-8"
        >
          <Plus size={12} /> Quick Add
        </button>
        <button
          type="button"
          onClick={() => { void window.api.trayOpenReview() }}
          className="kd-btn kd-btn-ghost text-[11px] h-8 px-2.5"
          title="Review Day"
          aria-label="Review Day"
        >
          <ClipboardCheck size={12} />
        </button>
        <button
          type="button"
          onClick={() => { void window.api.trayOpenMain() }}
          className="kd-btn kd-btn-ghost text-[11px] h-8 px-2.5"
          title="Open Koda"
          aria-label="Open Koda"
        >
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  )
}
