import React, { useMemo, useEffect, useState } from 'react'
import { Clock, Layers, Flame, Target, Plus, ArrowRight, Coffee, Sparkles } from 'lucide-react'
import type { AppSettings, DayData, TimeBlock } from '../../shared/types'
import { timeToMinutes, formatDuration, formatCountdown, blockDuration, nowTimeStr } from '../../shared/utils'
import DayNote from '../components/DayNote'

interface Props {
  settings: AppSettings
  dayData: DayData
  now: Date
  currentBlock: TimeBlock | null
  nextBlock: TimeBlock | null
  onNavigateToPlanner: () => void
  onOpenQuickAdd: () => void
  onOpenReview: () => void
  onLoadIdealDay?: () => void
  onUpdateDayNote?: (note: string) => void
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard({
  settings, dayData, now, currentBlock, nextBlock,
  onNavigateToPlanner, onOpenQuickAdd, onOpenReview, onLoadIdealDay, onUpdateDayNote,
}: Props) {
  const [weekData, setWeekData] = useState<DayData[]>([])
  const today = new Date().toISOString().split('T')[0]
  const showReview = now.getHours() >= 21

  useEffect(() => {
    const monday = new Date()
    monday.setDate(monday.getDate() - monday.getDay() + 1)
    window.api.getWeekStats(monday.toISOString().split('T')[0]).then(setWeekData)
  }, [])

  const stats = useMemo(() => {
    let totalPlanned = 0
    const byCat: Record<string, number> = {}
    for (const block of dayData.blocks) {
      const dur = timeToMinutes(block.endTime) - timeToMinutes(block.startTime)
      totalPlanned += dur
      byCat[block.categoryId] = (byCat[block.categoryId] || 0) + dur
    }
    return { totalPlanned, byCat }
  }, [dayData.blocks])

  const currentCat = useMemo(() => {
    if (!currentBlock) return null
    return settings.categories.find(c => c.id === currentBlock.categoryId) ?? null
  }, [currentBlock, settings.categories])

  const remaining = useMemo(() => {
    if (!currentBlock) return 0
    return Math.max(0, timeToMinutes(currentBlock.endTime) - now.getHours() * 60 - now.getMinutes())
  }, [currentBlock, now])

  const progress = useMemo(() => {
    if (!currentBlock) return 0
    const s = timeToMinutes(currentBlock.startTime)
    const e = timeToMinutes(currentBlock.endTime)
    const n = now.getHours() * 60 + now.getMinutes()
    if (e - s <= 0) return 0
    return Math.min(1, Math.max(0, (n - s) / (e - s)))
  }, [currentBlock, now])

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-[880px] mx-auto animate-fade-in">
        {/* Greeting */}
        <div className="mb-7">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
            {getGreeting(now.getHours())}
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Focus card */}
        {currentBlock && currentCat ? (
          <div
            className="rounded-2xl p-5 mb-5 animate-glow"
            style={{ background: `${currentCat.color}08`, border: `1px solid ${currentCat.color}30` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="kd-label mb-1.5" style={{ color: 'var(--text-muted)' }}>Currently Focused</div>
                <div className="text-base font-bold mb-0.5" style={{ color: currentCat.color }}>{currentBlock.title}</div>
                <div className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{currentCat.name}</div>
                <div className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
                  {currentBlock.startTime} → {currentBlock.endTime}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black font-mono tabular-nums" style={{ color: currentCat.color }}>
                  {formatCountdown(remaining)}
                </div>
                <div className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>remaining</div>
              </div>
            </div>
            <div className="h-1 rounded-full mt-4 overflow-hidden" style={{ background: `${currentCat.color}15` }}>
              <div
                className="h-full rounded-full animate-pulse-soft"
                style={{ width: `${progress * 100}%`, background: currentCat.color, transition: 'width 1s ease-out' }}
              />
            </div>
          </div>
        ) : dayData.blocks.length === 0 && onLoadIdealDay ? (
          <div
            className="rounded-2xl p-6 mb-5 text-center animate-fade-in relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.10), rgba(168, 85, 247, 0.06))',
              border: '1px solid rgba(99, 102, 241, 0.25)',
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{ background: 'radial-gradient(circle at 50% 0%, rgba(168,85,247,0.18), transparent 60%)' }}
            />
            <div className="relative">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)',
                }}
              >
                <Sparkles size={20} color="white" />
              </div>
              <div className="text-base font-extrabold mb-1" style={{ color: 'var(--text)' }}>
                Start with your Ideal Day
              </div>
              <div className="text-[12px] mb-4 max-w-[400px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Load a pre-filled day with English, sax, IT, sport, YouTube and rest blocks — then tweak as needed.
              </div>
              <div className="flex gap-2.5 justify-center">
                <button
                  type="button"
                  onClick={onLoadIdealDay}
                  className="kd-btn kd-btn-primary px-5 py-2"
                >
                  <Sparkles size={13} /> Load Ideal Day
                </button>
                <button
                  type="button"
                  onClick={onOpenQuickAdd}
                  className="kd-btn kd-btn-ghost px-4 py-2 text-[11px]"
                >
                  <Plus size={13} /> Add manually
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="kd-card rounded-2xl p-5 mb-5 text-center">
            <Coffee size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <div className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>No active block</div>
            <button type="button" onClick={onOpenQuickAdd} className="kd-btn kd-btn-outline mt-3 text-[11px]">
              <Plus size={13} /> Quick Add
            </button>
          </div>
        )}

        {/* Goal progress (when there's a daily goal and any planned time) */}
        {settings.goalDailyHours > 0 && stats.totalPlanned > 0 && (() => {
          const goalMins = settings.goalDailyHours * 60
          const pct = Math.min(100, (stats.totalPlanned / goalMins) * 100)
          const reached = stats.totalPlanned >= goalMins
          const remaining = Math.max(0, goalMins - stats.totalPlanned)
          return (
            <div className="kd-card rounded-xl p-4 mb-5">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <Target size={13} style={{ color: reached ? 'var(--success)' : 'var(--primary-light)' }} />
                  <span className="kd-label">Daily Goal</span>
                </div>
                <span className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {formatDuration(stats.totalPlanned)} / {formatDuration(goalMins)}
                  {reached ? (
                    <span className="ml-1.5 font-bold" style={{ color: 'var(--success)' }}>✓ Reached</span>
                  ) : (
                    <span className="ml-1.5" style={{ color: 'var(--text-muted)' }}>
                      · {formatDuration(remaining)} to go
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: reached
                      ? 'linear-gradient(90deg, var(--success), #4ade80)'
                      : 'linear-gradient(90deg, var(--primary), var(--secondary))',
                    transition: 'width 600ms ease-out',
                  }}
                />
              </div>
            </div>
          )
        })()}

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { icon: <Clock size={15} />, value: formatDuration(stats.totalPlanned), label: 'Planned', color: 'var(--primary)' },
            { icon: <Layers size={15} />, value: String(dayData.blocks.length), label: 'Blocks', color: 'var(--success)' },
            { icon: <Flame size={15} />, value: String(settings.streak), label: 'Streak', color: 'var(--secondary)' },
            { icon: <Target size={15} />, value: dayData.completionRate !== null ? `${dayData.completionRate}%` : '—', label: 'Score', color: dayData.reviewed ? 'var(--success)' : 'var(--text-faint)' },
          ].map((s, i) => (
            <div key={i} className="kd-card rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1.5" style={{ color: s.color }}>{s.icon}</div>
              <div className="kd-stat" style={{ color: s.color }}>{s.value}</div>
              <div className="kd-label mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          {/* Categories */}
          <div className="kd-card rounded-xl p-5">
            <div className="kd-label mb-3">Today's Categories</div>
            <div className="space-y-2.5">
              {settings.categories.filter(cat => stats.byCat[cat.id]).map(cat => {
                const mins = stats.byCat[cat.id] || 0
                const pct = stats.totalPlanned > 0 ? (mins / stats.totalPlanned) * 100 : 0
                return (
                  <div key={cat.id} className="flex items-center gap-2.5">
                    <div className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                    <div className="flex-1">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-semibold" style={{ color: cat.color }}>{cat.name}</span>
                        <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDuration(mins)}</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cat.color, transition: 'width 500ms ease-out' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
              {Object.keys(stats.byCat).length === 0 && (
                <div className="text-[11px] text-center py-3" style={{ color: 'var(--text-faint)' }}>No blocks planned</div>
              )}
            </div>
          </div>

          {/* Upcoming */}
          <div className="kd-card rounded-xl p-5">
            <div className="kd-label mb-3">Upcoming</div>
            <div className="space-y-1.5">
              {dayData.blocks
                .filter(b => {
                  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                  return b.startTime > nowTime || b === currentBlock
                })
                .slice(0, 5)
                .map(block => {
                  const cat = settings.categories.find(c => c.id === block.categoryId)
                  const isCurrent = block.id === currentBlock?.id
                  return (
                    <div
                      key={block.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg"
                      style={{
                        background: isCurrent ? `${cat?.color}0a` : 'transparent',
                        border: isCurrent ? `1px solid ${cat?.color}22` : '1px solid transparent',
                      }}
                    >
                      <div className="w-1 h-7 rounded-full flex-shrink-0" style={{ background: cat?.color ?? 'var(--border)' }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--text)' }}>{block.title}</div>
                        <div className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{block.startTime} → {block.endTime}</div>
                      </div>
                      {isCurrent && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${cat?.color}18`, color: cat?.color }}>NOW</span>
                      )}
                    </div>
                  )
                })}
              {dayData.blocks.length === 0 && (
                <div className="text-[11px] text-center py-3" style={{ color: 'var(--text-faint)' }}>Nothing planned</div>
              )}
            </div>
          </div>
        </div>

        {/* Day note */}
        {onUpdateDayNote && (
          <DayNote value={dayData.note} onChange={onUpdateDayNote} />
        )}

        {/* Week overview */}
        <div className="kd-card rounded-xl p-5 mb-5">
          <div className="kd-label mb-3">This Week</div>
          <div className="flex gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
              const wd = weekData[i]
              const totalMins = wd?.blocks.reduce((s, b) => s + timeToMinutes(b.endTime) - timeToMinutes(b.startTime), 0) ?? 0
              const fillPct = Math.min((totalMins / 600) * 100, 100)
              const isTodayCol = wd?.date === today
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full h-20 rounded-lg overflow-hidden flex items-end relative"
                    style={{ background: 'var(--elevated)' }}
                  >
                    <div
                      className="w-full rounded-lg"
                      style={{
                        height: `${Math.max(fillPct, 3)}%`,
                        background: isTodayCol
                          ? 'linear-gradient(0deg, var(--primary), var(--secondary))'
                          : wd?.reviewed ? 'var(--success)' : 'var(--border-hover)',
                        opacity: totalMins > 0 ? 1 : 0.2,
                        transition: 'height 500ms ease-out',
                      }}
                    />
                    {isTodayCol && (
                      <div className="absolute inset-0 rounded-lg" style={{ border: '1.5px solid var(--primary)', opacity: 0.5 }} />
                    )}
                  </div>
                  <span className="text-[8px] font-semibold" style={{ color: isTodayCol ? 'var(--primary-light)' : 'var(--text-faint)' }}>{day}</span>
                  <span className="text-[7px] font-mono" style={{ color: 'var(--text-faint)' }}>
                    {totalMins > 0 ? formatDuration(totalMins) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="button" onClick={onNavigateToPlanner} className="kd-btn kd-btn-primary flex-1 py-2.5">
            Open Planner <ArrowRight size={14} />
          </button>
          <button type="button" onClick={onOpenQuickAdd} className="kd-btn kd-btn-outline px-5 py-2.5">
            <Plus size={14} /> Quick Add
          </button>
          {showReview && !dayData.reviewed && (
            <button
              type="button"
              onClick={onOpenReview}
              className="kd-btn px-5 py-2.5 cursor-pointer"
              style={{ background: 'var(--success-soft)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              Review Day
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
