import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, Star, Clock, Sparkles } from 'lucide-react'
import type { AppSettings, DayData } from '../../shared/types'
import { timeToMinutes, formatDuration } from '../../shared/utils'

interface Props {
  settings: AppSettings
  dayData: DayData
  currentDate: string
  now: Date
  onGoToDay: (offset: number) => void
  onGoToToday: () => void
  onOpenReview: () => void
  onOpenSettings: () => void
  onLoadIdealDay?: () => void
}

export default function Sidebar({
  settings,
  dayData,
  currentDate,
  now,
  onGoToDay,
  onGoToToday,
  onOpenReview,
  onOpenSettings,
  onLoadIdealDay,
}: Props) {
  const dateObj = new Date(currentDate + 'T12:00:00')
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
  const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const year = dateObj.getFullYear()
  const isToday = currentDate === new Date().toISOString().split('T')[0]
  const showReviewBtn = isToday && now.getHours() >= 21

  const stats = useMemo(() => {
    const byCategory: Record<string, number> = {}
    let total = 0
    for (const block of dayData.blocks) {
      const dur = timeToMinutes(block.endTime) - timeToMinutes(block.startTime)
      total += dur
      byCategory[block.categoryId] = (byCategory[block.categoryId] || 0) + dur
    }
    return { total, byCategory }
  }, [dayData.blocks])

  const maxMinutes = Math.max(...Object.values(stats.byCategory), 1)

  return (
    <aside
      className="w-[210px] flex-shrink-0 flex flex-col border-r overflow-y-auto no-drag"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Date header */}
      <div className="px-4 pt-2 pb-3">
        <div className="kd-label mb-0.5" style={{ color: 'var(--primary-light)' }}>
          {monthDay}, {year}
        </div>
        <div className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
          {dayName}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1.5 mt-2.5">
          <button
            type="button"
            onClick={() => onGoToDay(-1)}
            className="kd-btn-ghost w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ background: 'var(--elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)', transition: 'all var(--transition-fast)' }}
            aria-label="Previous day"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={onGoToToday}
            className="flex-1 h-8 rounded-lg text-[11px] font-semibold cursor-pointer"
            style={{
              background: isToday ? 'var(--primary-soft)' : 'var(--elevated)',
              color: isToday ? 'var(--primary-light)' : 'var(--text-muted)',
              border: `1px solid ${isToday ? 'var(--primary)' : 'var(--border)'}`,
              transition: 'all var(--transition-fast)',
            }}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onGoToDay(1)}
            className="kd-btn-ghost w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ background: 'var(--elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)', transition: 'all var(--transition-fast)' }}
            aria-label="Next day"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="kd-label mb-2.5">Today's Plan</div>

        <div className="flex items-baseline gap-1.5 mb-3">
          <Clock size={13} style={{ color: 'var(--text-muted)' }} className="relative top-[1px]" />
          <span className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
            {formatDuration(stats.total)}
          </span>
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>planned</span>
        </div>

        {/* Category bars */}
        <div className="space-y-2">
          {settings.categories
            .filter((cat) => stats.byCategory[cat.id])
            .map((cat) => {
              const mins = stats.byCategory[cat.id] || 0
              const pct = (mins / maxMinutes) * 100
              return (
                <div key={cat.id}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="font-medium" style={{ color: cat.color }}>{cat.name}</span>
                    <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {formatDuration(mins)}
                    </span>
                  </div>
                  <div className="h-[4px] rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: cat.color,
                        transition: 'width 500ms ease-out',
                      }}
                    />
                  </div>
                </div>
              )
            })}

          {Object.keys(stats.byCategory).length === 0 && (
            <div className="py-2 text-center">
              <div className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
                No blocks yet
              </div>
              {onLoadIdealDay && (
                <button
                  type="button"
                  onClick={onLoadIdealDay}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-bold cursor-pointer animate-fade-in"
                  style={{
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <Sparkles size={12} />
                  Load Ideal Day
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Streak */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div
          className="rounded-xl p-3 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.06), rgba(99, 102, 241, 0.03))',
            border: '1px solid rgba(168, 85, 247, 0.15)',
          }}
        >
          <div className="text-2xl font-black text-gradient leading-none mb-0.5">
            {settings.streak}
          </div>
          <div className="flex items-center justify-center gap-1">
            <Star size={10} style={{ color: 'var(--secondary)' }} />
            <span className="text-[9px] font-semibold uppercase tracking-[0.8px]" style={{ color: 'var(--text-muted)' }}>
              Day Streak
            </span>
          </div>
          {settings.bestStreak > 0 && (
            <div className="text-[8px] mt-1" style={{ color: 'var(--text-faint)' }}>
              Best: {settings.bestStreak}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1" />

      {/* Bottom actions */}
      <div className="px-4 py-3 space-y-2">
        {showReviewBtn && (
          <button type="button" onClick={onOpenReview} className="kd-btn kd-btn-primary w-full h-8 text-[11px]">
            Review Day
          </button>
        )}
        <button type="button" onClick={onOpenSettings} className="kd-btn kd-btn-ghost w-full h-8 text-[11px]">
          Settings
        </button>
      </div>
    </aside>
  )
}
