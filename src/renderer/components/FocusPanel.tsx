import { useMemo, useState } from 'react'
import { Coffee, ArrowRight, Command, Play, Square, Timer } from 'lucide-react'
import type { AppSettings, TimeBlock } from '../../shared/types'
import { timeToMinutes, formatCountdown, formatDuration } from '../../shared/utils'
import { useStopwatch } from '../hooks/useTimer'
import PomodoroPanel from './PomodoroPanel'

interface Props {
  currentBlock: TimeBlock | null
  nextBlock: TimeBlock | null
  settings: AppSettings
  now: Date
  currentDate: string
  onUpdateBlock: (id: string, changes: Partial<TimeBlock>) => void
  onNotify?: (title: string, body: string, color: string) => void
}

export default function FocusPanel({
  currentBlock, nextBlock, settings, now, currentDate,
  onUpdateBlock, onNotify,
}: Props) {
  const isToday = currentDate === new Date().toISOString().split('T')[0]
  const [pomodoroEnabled, setPomodoroEnabled] = useState(false)

  const currentCat = useMemo(() => {
    if (!currentBlock) return null
    return settings.categories.find(c => c.id === currentBlock.categoryId) ?? null
  }, [currentBlock, settings.categories])

  const nextCat = useMemo(() => {
    if (!nextBlock) return null
    return settings.categories.find(c => c.id === nextBlock.categoryId) ?? null
  }, [nextBlock, settings.categories])

  const remaining = useMemo(() => {
    if (!currentBlock) return 0
    const nowMins = now.getHours() * 60 + now.getMinutes()
    return Math.max(0, timeToMinutes(currentBlock.endTime) - nowMins)
  }, [currentBlock, now])

  const progress = useMemo(() => {
    if (!currentBlock) return 0
    const s = timeToMinutes(currentBlock.startTime)
    const e = timeToMinutes(currentBlock.endTime)
    const n = now.getHours() * 60 + now.getMinutes()
    const total = e - s
    if (total <= 0) return 0
    return Math.min(1, Math.max(0, (n - s) / total))
  }, [currentBlock, now])

  // Block timer (real-time tracking)
  const trackingActive = !!currentBlock?.actualStart && !currentBlock?.actualEnd
  const trackingStart = trackingActive && currentBlock?.actualStart ? new Date(currentBlock.actualStart) : null
  const trackedSec = useStopwatch(trackingStart)

  const handleStartTracking = () => {
    if (!currentBlock) return
    onUpdateBlock(currentBlock.id, { actualStart: new Date().toISOString(), actualEnd: undefined })
  }

  const handleStopTracking = () => {
    if (!currentBlock) return
    onUpdateBlock(currentBlock.id, { actualEnd: new Date().toISOString() })
  }

  // Tracked summary if both set
  const trackedSummary = useMemo(() => {
    if (!currentBlock?.actualStart || !currentBlock?.actualEnd) return null
    const ms = new Date(currentBlock.actualEnd).getTime() - new Date(currentBlock.actualStart).getTime()
    const mins = Math.round(ms / 60000)
    return mins
  }, [currentBlock?.actualStart, currentBlock?.actualEnd])

  return (
    <aside
      className="w-[240px] flex-shrink-0 flex flex-col border-l overflow-y-auto no-drag"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Current block */}
      <div className="px-4 pt-2 pb-4">
        <div className="kd-label mb-3">
          {isToday ? 'Now' : 'Viewing'}
        </div>

        {currentBlock && currentCat ? (
          <div
            className="rounded-xl p-4 animate-glow"
            style={{
              background: `${currentCat.color}0a`,
              border: `1px solid ${currentCat.color}33`,
            }}
          >
            <div className="text-sm font-bold mb-0.5" style={{ color: currentCat.color }}>
              {currentCat.name}
            </div>
            <div className="text-xs font-medium mb-3" style={{ color: 'var(--text)' }}>
              {currentBlock.title}
            </div>

            {/* Countdown */}
            <div className="font-mono tabular-nums mb-1">
              <span className="text-2xl font-black" style={{ color: currentCat.color }}>
                {formatCountdown(remaining)}
              </span>
            </div>
            <div className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>remaining</div>

            {/* Progress */}
            <div className="h-1 rounded-full mt-3 overflow-hidden" style={{ background: `${currentCat.color}15` }}>
              <div
                className="h-full rounded-full animate-pulse-soft"
                style={{
                  width: `${progress * 100}%`,
                  background: currentCat.color,
                  transition: 'width 1s ease-out',
                }}
              />
            </div>
            <div className="flex justify-between text-[8px] mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
              <span>{currentBlock.startTime}</span>
              <span>{currentBlock.endTime}</span>
            </div>

            {/* Block timer (start / stop tracking) */}
            {isToday && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: `${currentCat.color}22` }}>
                {trackingActive ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        <Timer size={11} style={{ color: currentCat.color }} className="animate-pulse-soft" />
                        <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>Tracking</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: currentCat.color }}>
                        {formatStopwatch(trackedSec)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleStopTracking}
                      className="w-full py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      style={{
                        background: 'var(--error-soft)',
                        color: 'var(--error)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      <Square size={10} fill="currentColor" /> Stop
                    </button>
                  </>
                ) : trackedSummary !== null ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>Tracked</span>
                      <span className="text-[10px] font-mono font-bold" style={{ color: currentCat.color }}>
                        {formatDuration(trackedSummary)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleStartTracking}
                      className="w-full py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      style={{
                        background: 'var(--elevated)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      <Play size={10} fill="currentColor" /> Track again
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartTracking}
                    className="w-full py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    style={{
                      background: currentCat.color,
                      color: 'white',
                      border: `1px solid ${currentCat.color}`,
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <Play size={10} fill="currentColor" /> Start tracking
                  </button>
                )}
              </div>
            )}

            {/* Pomodoro toggle */}
            {isToday && (
              <button
                type="button"
                onClick={() => setPomodoroEnabled(v => !v)}
                className="mt-2 w-full py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                style={{
                  background: pomodoroEnabled ? `${currentCat.color}15` : 'transparent',
                  color: pomodoroEnabled ? currentCat.color : 'var(--text-muted)',
                  border: `1px dashed ${pomodoroEnabled ? currentCat.color : 'var(--border)'}`,
                  transition: 'all var(--transition-fast)',
                }}
                aria-pressed={pomodoroEnabled ? 'true' : 'false'}
              >
                {pomodoroEnabled ? 'Pomodoro On' : 'Enable Pomodoro'}
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl p-4 text-center kd-card">
            <Coffee size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {isToday ? 'Free time' : 'No active block'}
            </div>
          </div>
        )}
      </div>

      {/* Pomodoro */}
      {currentBlock && (
        <PomodoroPanel
          enabled={pomodoroEnabled && isToday}
          currentBlock={currentBlock}
          settings={settings}
          onNotify={onNotify}
        />
      )}

      {/* Next block */}
      {isToday && nextBlock && nextCat && (
        <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="kd-label mb-2.5">Next Up</div>
          <div
            className="rounded-lg p-3"
            style={{
              background: `${nextCat.color}06`,
              border: `1px solid ${nextCat.color}18`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <ArrowRight size={11} style={{ color: nextCat.color }} />
              <span className="text-[11px] font-semibold" style={{ color: nextCat.color }}>
                {nextCat.name}
              </span>
            </div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>
              {nextBlock.title}
            </div>
            <div className="text-[9px] mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
              {nextBlock.startTime} → {nextBlock.endTime}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1" />

      {/* Shortcut hint */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <kbd
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
            style={{ background: 'var(--elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            <Command size={9} /> K
          </kbd>
          <span className="text-[9px]" style={{ color: 'var(--text-faint)' }}>Quick Add</span>
        </div>
      </div>
    </aside>
  )
}

function formatStopwatch(sec: number): string {
  const total = Math.floor(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
