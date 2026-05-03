import { useState, useEffect, useMemo, useCallback } from 'react'
import { TrendingUp, Calendar, Target, Flame, Download, Trophy, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { AppSettings, DayData } from '../../shared/types'
import { timeToMinutes, formatDuration } from '../../shared/utils'

interface Props {
  settings: AppSettings
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  return date
}

function fmtDateISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function fmtDateLabel(date: string): string {
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function Stats({ settings }: Props) {
  const [weekData, setWeekData] = useState<DayData[]>([])
  const [monthData, setMonthData] = useState<DayData[]>([])
  const [prevWeekData, setPrevWeekData] = useState<DayData[]>([])
  const [yearData, setYearData] = useState<DayData[]>([])
  const today = useMemo(() => new Date(), [])

  useEffect(() => {
    const monday = getMonday(today)
    window.api.getWeekStats(fmtDateISO(monday)).then(setWeekData)
    const prevMonday = new Date(monday)
    prevMonday.setDate(prevMonday.getDate() - 7)
    window.api.getWeekStats(fmtDateISO(prevMonday)).then(setPrevWeekData)
    const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    window.api.getMonthStats(monthStr).then(setMonthData)

    // Year heatmap: 365 days back from today
    const yearAgo = new Date(today)
    yearAgo.setDate(yearAgo.getDate() - 364)
    window.api.getRangeStats(fmtDateISO(yearAgo), fmtDateISO(today)).then(setYearData)
  }, [today])

  const weekStats = useMemo(() => {
    let totalMins = 0
    const byCat: Record<string, number> = {}
    const dailyTotals: number[] = []
    weekData.forEach(day => {
      let dayTotal = 0
      day.blocks.forEach(b => {
        const dur = timeToMinutes(b.endTime) - timeToMinutes(b.startTime)
        totalMins += dur; dayTotal += dur
        byCat[b.categoryId] = (byCat[b.categoryId] || 0) + dur
      })
      dailyTotals.push(dayTotal)
    })
    return { totalMins, byCat, dailyTotals }
  }, [weekData])

  const prevWeekTotal = useMemo(() =>
    prevWeekData.reduce((s, day) => s + day.blocks.reduce((bs, b) => bs + timeToMinutes(b.endTime) - timeToMinutes(b.startTime), 0), 0),
    [prevWeekData])

  const monthStats = useMemo(() => {
    let totalMins = 0; let reviewedDays = 0; let totalScore = 0
    const byCat: Record<string, number> = {}
    monthData.forEach(day => {
      day.blocks.forEach(b => {
        const dur = timeToMinutes(b.endTime) - timeToMinutes(b.startTime)
        totalMins += dur; byCat[b.categoryId] = (byCat[b.categoryId] || 0) + dur
      })
      if (day.reviewed && day.completionRate != null) { reviewedDays++; totalScore += day.completionRate }
    })
    return { totalMins, avgScore: reviewedDays > 0 ? Math.round(totalScore / reviewedDays) : 0, byCat }
  }, [monthData])

  // ── Year heatmap ──
  // Build map date → minutes
  const heatmapByDate = useMemo(() => {
    const m = new Map<string, { mins: number; goalPct: number }>()
    const goalMins = settings.goalDailyHours * 60
    for (const day of yearData) {
      const mins = day.blocks.reduce((s, b) =>
        s + (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)), 0)
      const goalPct = goalMins > 0 ? Math.min(1, mins / goalMins) : 0
      m.set(day.date, { mins, goalPct })
    }
    return m
  }, [yearData, settings.goalDailyHours])

  // Year-long stats
  const yearStats = useMemo(() => {
    let bestDayMins = 0
    let bestDayDate = ''
    let totalMins = 0
    let activeDays = 0
    const catBlockCounts: Record<string, number> = {}
    for (const day of yearData) {
      const mins = day.blocks.reduce((s, b) =>
        s + (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)), 0)
      if (mins > bestDayMins) { bestDayMins = mins; bestDayDate = day.date }
      if (mins > 0) activeDays++
      totalMins += mins
      day.blocks.forEach(b => {
        catBlockCounts[b.categoryId] = (catBlockCounts[b.categoryId] || 0) + 1
      })
    }
    const mostUsedCat = Object.entries(catBlockCounts).sort((a, b) => b[1] - a[1])[0]
    return {
      bestDayMins,
      bestDayDate,
      totalMins,
      activeDays,
      mostUsedCatId: mostUsedCat?.[0] ?? null,
      mostUsedCatBlocks: mostUsedCat?.[1] ?? 0,
    }
  }, [yearData])

  // Trend: compare last 14 days avg vs 14 days before that
  const trend = useMemo(() => {
    const sorted = [...yearData].sort((a, b) => a.date.localeCompare(b.date))
    const last14 = sorted.slice(-14)
    const prev14 = sorted.slice(-28, -14)
    const avg = (days: DayData[]) => {
      if (days.length === 0) return 0
      const total = days.reduce((s, d) =>
        s + d.blocks.reduce((bs, b) => bs + timeToMinutes(b.endTime) - timeToMinutes(b.startTime), 0), 0)
      return total / days.length
    }
    const recent = avg(last14)
    const previous = avg(prev14)
    const delta = recent - previous
    const direction = Math.abs(delta) < 5 ? 'flat' : delta > 0 ? 'up' : 'down'
    return { recent, previous, delta, direction: direction as 'up' | 'down' | 'flat' }
  }, [yearData])

  const weekDiff = weekStats.totalMins - prevWeekTotal
  const maxDaily = Math.max(...weekStats.dailyTotals, 1)

  // ── CSV export ──
  const exportCSV = useCallback(() => {
    const sorted = [...yearData].sort((a, b) => a.date.localeCompare(b.date))
    const rows: string[] = []
    rows.push('Date,Title,Category,Start,End,Duration (min),Completed,Note')
    for (const day of sorted) {
      for (const block of day.blocks) {
        const cat = settings.categories.find(c => c.id === block.categoryId)
        const dur = timeToMinutes(block.endTime) - timeToMinutes(block.startTime)
        const completion = block.completed ?? ''
        const escape = (s: string) => `"${s.replace(/"/g, '""')}"`
        rows.push([
          day.date,
          escape(block.title),
          escape(cat?.name ?? ''),
          block.startTime,
          block.endTime,
          String(dur),
          completion,
          escape(block.note ?? ''),
        ].join(','))
      }
    }
    const csv = rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `koda-blocks-${fmtDateISO(today)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [yearData, settings.categories, today])

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-[920px] mx-auto animate-fade-in">
        <div className="mb-7 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>Statistics</h1>
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>Track your productivity</p>
          </div>
          <button
            type="button"
            onClick={exportCSV}
            className="kd-btn kd-btn-ghost text-[11px]"
            aria-label="Export blocks as CSV"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>

        {/* Empty state when no week + month data yet */}
        {weekStats.totalMins === 0 && monthStats.totalMins === 0 ? (
          <div
            className="rounded-2xl p-10 text-center animate-fade-in"
            style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}
          >
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'var(--primary-soft)', color: 'var(--primary-light)' }}
            >
              <TrendingUp size={20} />
            </div>
            <div className="text-base font-extrabold mb-1" style={{ color: 'var(--text)' }}>
              No stats yet
            </div>
            <div className="text-[12px] max-w-[400px] mx-auto" style={{ color: 'var(--text-muted)' }}>
              Add some blocks to your day and stats will start filling in here — daily hours, category breakdowns, weekly trends and more.
            </div>
          </div>
        ) : null}

        {/* Top stats */}
        {(weekStats.totalMins > 0 || monthStats.totalMins > 0) && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            {
              icon: <TrendingUp size={15} />, value: formatDuration(weekStats.totalMins), label: 'This Week',
              sub: `${weekDiff >= 0 ? '+' : ''}${formatDuration(Math.abs(weekDiff))} vs last`,
              subColor: weekDiff >= 0 ? 'var(--success)' : 'var(--error)', color: 'var(--primary)',
            },
            { icon: <Calendar size={15} />, value: formatDuration(monthStats.totalMins), label: 'This Month', color: 'var(--success)' },
            { icon: <Target size={15} />, value: `${monthStats.avgScore}%`, label: 'Avg Score', color: 'var(--warning)' },
            { icon: <Flame size={15} />, value: String(settings.streak), label: 'Streak',
              sub: `Best: ${settings.bestStreak}`, subColor: 'var(--text-faint)', color: 'var(--secondary)' },
          ].map((s, i) => (
            <div key={i} className="kd-card rounded-xl p-4">
              <div className="mb-1.5" style={{ color: s.color }}>{s.icon}</div>
              <div className="kd-stat" style={{ color: s.color }}>{s.value}</div>
              <div className="kd-label mt-0.5">{s.label}</div>
              {s.sub && <div className="text-[9px] font-mono mt-0.5" style={{ color: s.subColor }}>{s.sub}</div>}
            </div>
          ))}
        </div>
        )}

        {/* Heatmap */}
        <YearHeatmap
          today={today}
          dataByDate={heatmapByDate}
          goalMins={settings.goalDailyHours * 60}
        />

        {/* Highlights row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Best day */}
          <div className="kd-card rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy size={13} style={{ color: 'var(--warning)' }} />
              <span className="kd-label">Best Day</span>
            </div>
            {yearStats.bestDayMins > 0 ? (
              <>
                <div className="text-base font-extrabold" style={{ color: 'var(--text)' }}>
                  {formatDuration(yearStats.bestDayMins)}
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {fmtDateLabel(yearStats.bestDayDate)}
                </div>
              </>
            ) : (
              <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>No data yet</div>
            )}
          </div>

          {/* Most consistent */}
          <div className="kd-card rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Activity size={13} style={{ color: 'var(--primary-light)' }} />
              <span className="kd-label">Most Logged Category</span>
            </div>
            {yearStats.mostUsedCatId ? (() => {
              const cat = settings.categories.find(c => c.id === yearStats.mostUsedCatId)
              return (
                <>
                  <div className="text-base font-extrabold" style={{ color: cat?.color ?? 'var(--text)' }}>
                    {cat?.name ?? 'Unknown'}
                  </div>
                  <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {yearStats.mostUsedCatBlocks} blocks
                  </div>
                </>
              )
            })() : (
              <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>No data yet</div>
            )}
          </div>

          {/* Trend */}
          <div className="kd-card rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              {trend.direction === 'up' ? <ArrowUpRight size={13} style={{ color: 'var(--success)' }} /> :
               trend.direction === 'down' ? <ArrowDownRight size={13} style={{ color: 'var(--error)' }} /> :
               <Activity size={13} style={{ color: 'var(--text-muted)' }} />}
              <span className="kd-label">14-Day Trend</span>
            </div>
            <div
              className="text-base font-extrabold capitalize"
              style={{ color: trend.direction === 'up' ? 'var(--success)' : trend.direction === 'down' ? 'var(--error)' : 'var(--text-muted)' }}
            >
              {trend.direction}
            </div>
            <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {trend.delta >= 0 ? '+' : ''}{formatDuration(Math.abs(Math.round(trend.delta)))}/day vs prior
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Weekly bar chart */}
          <div className="kd-card rounded-2xl p-5">
            <div className="kd-label mb-4">Daily Hours — This Week</div>
            <div className="flex items-end gap-2.5 h-36">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                const mins = weekStats.dailyTotals[i] ?? 0
                const pct = (mins / maxDaily) * 100
                const isT = i === ((today.getDay() + 6) % 7)
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[8px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {mins > 0 ? formatDuration(mins) : '—'}
                    </span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-md"
                        style={{
                          height: `${Math.max(pct, 4)}%`,
                          background: isT ? 'linear-gradient(0deg, var(--primary), var(--secondary))' : mins > 0 ? 'var(--primary)' : 'var(--border)',
                          opacity: mins > 0 ? (isT ? 1 : 0.5) : 0.15,
                          transition: 'height 500ms ease-out',
                        }}
                      />
                    </div>
                    <span className="text-[8px] font-semibold" style={{ color: isT ? 'var(--primary-light)' : 'var(--text-faint)' }}>{day}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Category breakdown */}
          <div className="kd-card rounded-2xl p-5">
            <div className="kd-label mb-4">Categories — This Week</div>
            <div className="space-y-2.5">
              {settings.categories
                .filter(cat => weekStats.byCat[cat.id])
                .sort((a, b) => (weekStats.byCat[b.id] ?? 0) - (weekStats.byCat[a.id] ?? 0))
                .map(cat => {
                  const mins = weekStats.byCat[cat.id] ?? 0
                  const pct = weekStats.totalMins > 0 ? (mins / weekStats.totalMins) * 100 : 0
                  return (
                    <div key={cat.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold" style={{ color: cat.color }}>{cat.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{formatDuration(mins)}</span>
                          <span className="text-[8px] font-mono" style={{ color: 'var(--text-faint)' }}>{Math.round(pct)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cat.color, transition: 'width 600ms ease-out' }} />
                      </div>
                    </div>
                  )
                })}
              {Object.keys(weekStats.byCat).length === 0 && (
                <div className="text-[11px] text-center py-6" style={{ color: 'var(--text-faint)' }}>No data this week</div>
              )}
            </div>
          </div>
        </div>

        {/* Energy Map */}
        <div className="kd-card rounded-2xl p-5 mb-6">
          <div className="kd-label mb-4">Energy Map — Today</div>
          {(() => {
            const todayStr = fmtDateISO(today)
            const todayData = weekData.find(d => d.date === todayStr)
            if (!todayData || todayData.blocks.length === 0) {
              return <div className="text-[11px] text-center py-4" style={{ color: 'var(--text-faint)' }}>No blocks today</div>
            }
            const startH = settings.timelineStart
            const endH = settings.timelineEnd
            const totalMins = (endH - startH) * 60
            return (
              <div>
                <div className="h-7 rounded-lg overflow-hidden flex gap-px" style={{ background: 'var(--elevated)' }}>
                  {todayData.blocks.map(block => {
                    const dur = timeToMinutes(block.endTime) - timeToMinutes(block.startTime)
                    const width = (dur / totalMins) * 100
                    const cat = settings.categories.find(c => c.id === block.categoryId)
                    return (
                      <div
                        key={block.id}
                        className="h-full cursor-pointer group relative"
                        style={{ width: `${width}%`, background: cat?.color, opacity: block.categoryId === 'rest' ? 0.3 : 0.8, transition: 'opacity var(--transition-fast)' }}
                        title={`${block.title} (${block.startTime}–${block.endTime})`}
                      />
                    )
                  })}
                </div>
                <div className="flex justify-between mt-1 text-[8px] font-mono" style={{ color: 'var(--text-faint)' }}>
                  <span>{String(startH).padStart(2, '0')}:00</span>
                  <span>{String(endH).padStart(2, '0')}:00</span>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Monthly category cards */}
        <div className="kd-card rounded-2xl p-5">
          <div className="kd-label mb-4">Categories — This Month</div>
          <div className="grid grid-cols-3 gap-3">
            {settings.categories
              .filter(cat => monthStats.byCat[cat.id])
              .sort((a, b) => (monthStats.byCat[b.id] ?? 0) - (monthStats.byCat[a.id] ?? 0))
              .map(cat => {
                const mins = monthStats.byCat[cat.id] ?? 0
                return (
                  <div key={cat.id} className="rounded-xl p-4" style={{ background: `${cat.color}08`, border: `1px solid ${cat.color}15` }}>
                    <div className="text-[13px] font-bold" style={{ color: cat.color }}>{cat.name}</div>
                    <div className="text-lg font-extrabold font-mono mt-0.5" style={{ color: 'var(--text)' }}>{formatDuration(mins)}</div>
                    <div className="text-[8px]" style={{ color: 'var(--text-faint)' }}>
                      {monthStats.totalMins > 0 ? Math.round((mins / monthStats.totalMins) * 100) : 0}% of total
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Year heatmap (53 cols × 7 rows) ──
function YearHeatmap({
  today,
  dataByDate,
  goalMins,
}: {
  today: Date
  dataByDate: Map<string, { mins: number; goalPct: number }>
  goalMins: number
}) {
  // Build a 53x7 grid going back from today (Sunday at top — GitHub-style)
  // Find the most recent Sunday on or after today's column
  const cells = useMemo(() => {
    // Get end-of-week Sunday after today (so the right column is "this week")
    const end = new Date(today)
    end.setHours(0, 0, 0, 0)
    const dow = end.getDay() // 0=Sun
    // Walk back until we have ~371 days (53 weeks × 7) ending today
    const NUM_DAYS = 53 * 7
    const start = new Date(end)
    start.setDate(end.getDate() - (NUM_DAYS - 1) + (6 - dow))
    // ^ We want the grid to end on the Saturday following today, so the column with today is the rightmost.
    // Simpler: build columns left-to-right; rows = day-of-week (0..6, Sun..Sat)

    const cells: Array<{ date: string; mins: number; goalPct: number; isFuture: boolean; isToday: boolean }> = []
    // generate exactly NUM_DAYS days
    for (let i = 0; i < NUM_DAYS; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const iso = fmtDateISO(d)
      const data = dataByDate.get(iso)
      const isFuture = d.getTime() > today.getTime()
      const isToday = iso === fmtDateISO(today)
      cells.push({
        date: iso,
        mins: data?.mins ?? 0,
        goalPct: data?.goalPct ?? 0,
        isFuture,
        isToday,
      })
    }
    return cells
  }, [today, dataByDate])

  const [hover, setHover] = useState<{ x: number; y: number; date: string; mins: number } | null>(null)

  const colorFor = (cell: { mins: number; goalPct: number; isFuture: boolean }) => {
    if (cell.isFuture) return 'transparent'
    if (cell.mins === 0) return 'var(--border)'
    // 4 levels based on goalPct
    const p = cell.goalPct
    if (p < 0.25) return 'rgba(99, 102, 241, 0.18)'
    if (p < 0.5) return 'rgba(99, 102, 241, 0.40)'
    if (p < 0.85) return 'rgba(99, 102, 241, 0.70)'
    return 'rgba(99, 102, 241, 1)'
  }

  // Group into columns of 7
  const cols: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) {
    cols.push(cells.slice(i, i + 7))
  }

  // Month labels: at top of column where month changes
  const monthLabels = useMemo(() => {
    const labels: Array<{ col: number; label: string }> = []
    let lastMonth = -1
    cols.forEach((col, i) => {
      const first = col[0]
      if (!first) return
      const m = new Date(first.date + 'T12:00:00').getMonth()
      if (m !== lastMonth) {
        const monthName = new Date(first.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })
        labels.push({ col: i, label: monthName })
        lastMonth = m
      }
    })
    return labels
  }, [cols])

  return (
    <div className="kd-card rounded-2xl p-5 mb-6 relative">
      <div className="flex items-center justify-between mb-3">
        <div className="kd-label">Activity — Last Year</div>
        <div className="flex items-center gap-1.5 text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
          <span>Less</span>
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--border)' }} />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(99, 102, 241, 0.18)' }} />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(99, 102, 241, 0.40)' }} />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(99, 102, 241, 0.70)' }} />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(99, 102, 241, 1)' }} />
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="inline-block">
          {/* Month labels row */}
          <div className="flex" style={{ marginLeft: '24px', height: '14px' }}>
            {cols.map((_, i) => {
              const lbl = monthLabels.find(l => l.col === i)
              return (
                <div key={i} className="text-[9px] font-mono" style={{ width: '12px', marginRight: '2px', color: 'var(--text-muted)' }}>
                  {lbl ? lbl.label : ''}
                </div>
              )
            })}
          </div>

          <div className="flex gap-[2px]">
            {/* Day labels (Sun..Sat) */}
            <div className="flex flex-col gap-[2px]" style={{ marginRight: '4px' }}>
              {['Sun', '', 'Tue', '', 'Thu', '', 'Sat'].map((d, i) => (
                <div key={i} className="text-[9px] font-mono leading-none" style={{ height: '12px', width: '20px', color: 'var(--text-faint)' }}>
                  {d}
                </div>
              ))}
            </div>

            {cols.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[2px]">
                {col.map((cell, ri) => (
                  <div
                    key={`${ci}-${ri}`}
                    className="rounded-sm"
                    style={{
                      width: '12px',
                      height: '12px',
                      background: colorFor(cell),
                      outline: cell.isToday ? '1.5px solid var(--text)' : 'none',
                      outlineOffset: '0px',
                      cursor: cell.isFuture ? 'default' : 'pointer',
                      transition: 'transform var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      if (cell.isFuture) return
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                      setHover({ x: rect.left + rect.width / 2, y: rect.top, date: cell.date, mins: cell.mins })
                    }}
                    onMouseLeave={() => setHover(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {hover && (
        <div
          className="fixed z-50 px-2.5 py-1.5 rounded-lg pointer-events-none animate-fade-in"
          style={{
            left: hover.x,
            top: hover.y - 8,
            transform: 'translate(-50%, -100%)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div className="text-[11px] font-bold" style={{ color: 'var(--text)' }}>
            {hover.mins > 0 ? formatDuration(hover.mins) : 'No activity'}
          </div>
          <div className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
            {fmtDateLabel(hover.date)}
            {goalMins > 0 && hover.mins > 0 && ` · ${Math.round((hover.mins / goalMins) * 100)}% of goal`}
          </div>
        </div>
      )}
    </div>
  )
}
