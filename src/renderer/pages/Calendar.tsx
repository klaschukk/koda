import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Check, ArrowRight } from 'lucide-react'
import type { AppSettings, DayData } from '../../shared/types'
import { timeToMinutes, formatDuration } from '../../shared/utils'

interface Props {
  settings: AppSettings
  currentDate: string
  onSelectDate: (date: string) => void
  onNavigateToPlanner: () => void
}

function getDaysInMonth(y: number, m: number): number { return new Date(y, m + 1, 0).getDate() }
function getFirstDayOfWeek(y: number, m: number): number {
  const d = new Date(y, m, 1).getDay()
  return d === 0 ? 6 : d - 1
}

export default function Calendar({ settings, currentDate, onSelectDate, onNavigateToPlanner }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [viewYear, setViewYear] = useState(() => parseInt(currentDate.split('-')[0]))
  const [viewMonth, setViewMonth] = useState(() => parseInt(currentDate.split('-')[1]) - 1)
  const [monthData, setMonthData] = useState<DayData[]>([])
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null)

  const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`

  useEffect(() => {
    window.api.getMonthStats(monthStr).then(setMonthData)
  }, [monthStr])

  const dayMap = useMemo(() => {
    const m: Record<string, DayData> = {}
    monthData.forEach(d => { m[d.date] = d })
    return m
  }, [monthData])

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)
  const monthName = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1)
  }, [viewMonth])
  const nextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1)
  }, [viewMonth])

  const handleDayClick = (dateStr: string) => {
    const data = dayMap[dateStr]
    setSelectedDay(data && data.blocks.length > 0 ? data : null)
    onSelectDate(dateStr)
  }

  const getHeatColor = (d: DayData | undefined): string => {
    if (!d || d.blocks.length === 0) return 'transparent'
    const total = d.blocks.reduce((s, b) => s + timeToMinutes(b.endTime) - timeToMinutes(b.startTime), 0)
    if (total >= 480) return 'rgba(99,102,241,0.35)'
    if (total >= 360) return 'rgba(99,102,241,0.22)'
    if (total >= 180) return 'rgba(99,102,241,0.12)'
    return 'rgba(99,102,241,0.06)'
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-[880px] mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>Calendar</h1>
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Monthly overview</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={prevMonth} className="kd-btn kd-btn-ghost w-8 h-8 p-0" aria-label="Previous month">
              <ChevronLeft size={15} />
            </button>
            <span className="text-[13px] font-bold w-[160px] text-center" style={{ color: 'var(--text)' }}>{monthName}</span>
            <button type="button" onClick={nextMonth} className="kd-btn kd-btn-ghost w-8 h-8 p-0" aria-label="Next month">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="kd-card rounded-2xl overflow-hidden mb-5">
          <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="py-2.5 text-center kd-label">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e-${i}`} className="h-[88px] border-b border-r" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const data = dayMap[dateStr]
              const isT = dateStr === today
              const isSel = dateStr === currentDate
              const totalMins = data?.blocks.reduce((s, b) => s + timeToMinutes(b.endTime) - timeToMinutes(b.startTime), 0) ?? 0

              return (
                <div
                  key={day}
                  className="h-[88px] border-b border-r p-1.5 cursor-pointer relative group"
                  style={{
                    borderColor: 'var(--border)',
                    background: isSel ? 'var(--primary-soft)' : getHeatColor(data),
                    transition: 'background var(--transition-fast)',
                  }}
                  onClick={() => handleDayClick(dateStr)}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100" style={{ background: 'var(--elevated)', transition: 'opacity var(--transition-fast)' }} />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] font-semibold ${isT ? 'w-5 h-5 rounded-full flex items-center justify-center' : ''}`}
                        style={{
                          color: isT ? 'white' : isSel ? 'var(--primary-light)' : 'var(--text)',
                          background: isT ? 'var(--primary)' : 'transparent',
                        }}
                      >
                        {day}
                      </span>
                      {data?.reviewed && (
                        <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: 'var(--success)' }}>
                          <Check size={8} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    {data && data.blocks.length > 0 && (
                      <div className="mt-1">
                        <div className="text-[8px] font-mono" style={{ color: 'var(--text-muted)' }}>
                          {formatDuration(totalMins)}
                        </div>
                        <div className="flex gap-px mt-0.5">
                          {data.blocks.slice(0, 6).map(b => {
                            const cat = settings.categories.find(c => c.id === b.categoryId)
                            return <div key={b.id} className="w-1.5 h-1.5 rounded-sm" style={{ background: cat?.color ?? 'var(--border)' }} />
                          })}
                        </div>
                      </div>
                    )}
                    {data?.completionRate != null && (
                      <div className="absolute bottom-0.5 right-0.5 text-[7px] font-bold font-mono"
                        style={{ color: data.completionRate >= 80 ? 'var(--success)' : data.completionRate >= 50 ? 'var(--warning)' : 'var(--error)' }}>
                        {data.completionRate}%
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Empty state when month has no data and nothing selected */}
        {!selectedDay && monthData.length === 0 && (
          <div
            className="rounded-2xl p-8 text-center animate-fade-in"
            style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}
          >
            <div className="text-2xl mb-2" style={{ opacity: 0.3 }}>📅</div>
            <div className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text)' }}>
              Nothing planned in {monthName.split(' ')[0]} yet
            </div>
            <div className="text-[11px] max-w-[360px] mx-auto" style={{ color: 'var(--text-muted)' }}>
              Click any day above to see its details, or open Planner to start filling in your schedule.
            </div>
            <button
              type="button"
              onClick={onNavigateToPlanner}
              className="kd-btn kd-btn-primary mt-4 px-5 py-2 text-[12px]"
            >
              Open Planner <ArrowRight size={13} />
            </button>
          </div>
        )}

        {/* Hint when month has data but nothing selected */}
        {!selectedDay && monthData.length > 0 && (
          <div
            className="rounded-xl p-4 text-center animate-fade-in"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Click any day with blocks to see its breakdown
            </div>
          </div>
        )}

        {/* Selected day detail */}
        {selectedDay && (
          <div className="kd-card rounded-2xl p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-base font-bold" style={{ color: 'var(--text)' }}>
                  {new Date(selectedDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {selectedDay.blocks.length} blocks · {formatDuration(selectedDay.blocks.reduce((s, b) => s + timeToMinutes(b.endTime) - timeToMinutes(b.startTime), 0))}
                  {selectedDay.completionRate != null && ` · ${selectedDay.completionRate}%`}
                </div>
              </div>
              <button type="button" onClick={onNavigateToPlanner} className="kd-btn kd-btn-outline text-[11px]">
                Planner <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-1.5">
              {selectedDay.blocks.map(block => {
                const cat = settings.categories.find(c => c.id === block.categoryId)
                return (
                  <div key={block.id} className="flex items-center gap-2.5 p-2.5 rounded-lg"
                    style={{ background: `${cat?.color}06`, border: `1px solid ${cat?.color}15` }}>
                    <div className="w-1 h-7 rounded-full" style={{ background: cat?.color }} />
                    <div className="flex-1">
                      <div className="text-[11px] font-semibold" style={{ color: 'var(--text)' }}>{block.title}</div>
                      <div className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{block.startTime} → {block.endTime}</div>
                    </div>
                    {block.completed && (
                      <span className="text-[11px]">
                        {block.completed === 'done' ? <Check size={14} style={{ color: 'var(--success)' }} /> :
                         block.completed === 'partial' ? <span className="text-[11px] font-bold" style={{ color: 'var(--warning)' }}>~</span> :
                         <span className="text-[11px] font-bold" style={{ color: 'var(--error)' }}>✕</span>}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
