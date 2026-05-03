import { useState, useMemo } from 'react'
import { Check, AlertTriangle, XCircle, Flame, Trophy, X } from 'lucide-react'
import type { AppSettings, DayData, TimeBlock } from '../../shared/types'
import { timeToMinutes, formatDuration } from '../../shared/utils'

interface Props {
  dayData: DayData
  settings: AppSettings
  onSave: (data: DayData) => void
  onClose: () => void
}

type ReviewStep = 'review' | 'result'

export default function DayReview({ dayData, settings, onSave, onClose }: Props) {
  const [step, setStep] = useState<ReviewStep>('review')
  const [blockStatus, setBlockStatus] = useState<Record<string, TimeBlock['completed']>>(() => {
    const s: Record<string, TimeBlock['completed']> = {}
    dayData.blocks.forEach(b => { s[b.id] = b.completed ?? null })
    return s
  })
  const [currentIdx, setCurrentIdx] = useState(0)
  const blocks = dayData.blocks
  const currentBlock = blocks[currentIdx]

  const markBlock = (status: 'done' | 'partial' | 'skipped') => {
    setBlockStatus(prev => ({ ...prev, [currentBlock.id]: status }))
    if (currentIdx < blocks.length - 1) setCurrentIdx(currentIdx + 1)
    else setStep('result')
  }

  const stats = useMemo(() => {
    let totalMins = 0; let doneMins = 0
    const byCat: Record<string, { total: number; done: number }> = {}
    for (const block of blocks) {
      const dur = timeToMinutes(block.endTime) - timeToMinutes(block.startTime)
      totalMins += dur
      const catId = block.categoryId
      if (!byCat[catId]) byCat[catId] = { total: 0, done: 0 }
      byCat[catId].total += dur
      const status = blockStatus[block.id]
      if (status === 'done') { doneMins += dur; byCat[catId].done += dur }
      else if (status === 'partial') { doneMins += dur * 0.5; byCat[catId].done += dur * 0.5 }
    }
    return { totalMins, doneMins, rate: totalMins > 0 ? Math.round((doneMins / totalMins) * 100) : 0, byCat }
  }, [blocks, blockStatus])

  const handleSave = () => {
    onSave({
      ...dayData,
      blocks: blocks.map(b => ({ ...b, completed: blockStatus[b.id] ?? null })),
      reviewed: true,
      completionRate: stats.rate,
    })
    onClose()
  }

  const getCat = (id: string) => settings.categories.find(c => c.id === id)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(16px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Day review"
    >
      <div
        className="w-[460px] rounded-2xl overflow-hidden animate-slide-up"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer z-10"
          style={{ color: 'var(--text-muted)', transition: 'color var(--transition-fast)' }}
          aria-label="Close"
        >
          <X size={15} />
        </button>

        {step === 'review' && currentBlock ? (
          <div className="p-6">
            <div className="text-center mb-5">
              <div className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>Day Review</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Block {currentIdx + 1} of {blocks.length}
              </div>
              {/* Progress dots */}
              <div className="flex justify-center gap-1.5 mt-3">
                {blocks.map((b, i) => {
                  const s = blockStatus[b.id]
                  let bg = 'var(--border)'
                  if (s === 'done') bg = 'var(--success)'
                  else if (s === 'partial') bg = 'var(--warning)'
                  else if (s === 'skipped') bg = 'var(--error)'
                  else if (i === currentIdx) bg = 'var(--primary)'
                  return <div key={b.id} className="w-2 h-2 rounded-full" style={{ background: bg, transition: 'background var(--transition-fast)' }} />
                })}
              </div>
            </div>

            {(() => {
              const cat = getCat(currentBlock.categoryId)
              const color = cat?.color ?? '#64748b'
              return (
                <div
                  className="rounded-xl p-5 mb-5"
                  style={{ background: `${color}0a`, border: `1px solid ${color}22` }}
                >
                  <div className="text-base font-bold mb-0.5" style={{ color }}>{currentBlock.title}</div>
                  <div className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{cat?.name}</div>
                  <div className="text-[10px] font-mono mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    {currentBlock.startTime} → {currentBlock.endTime}
                  </div>
                </div>
              )
            })()}

            <div className="flex gap-2.5">
              <button
                type="button"
                className="flex-1 py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: 'var(--success-soft)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)', transition: 'all var(--transition-fast)' }}
                onClick={() => markBlock('done')}
              >
                <Check size={15} /> Done
              </button>
              <button
                type="button"
                className="flex-1 py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: 'var(--warning-soft)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.2)', transition: 'all var(--transition-fast)' }}
                onClick={() => markBlock('partial')}
              >
                <AlertTriangle size={15} /> Partial
              </button>
              <button
                type="button"
                className="flex-1 py-3 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: 'var(--error-soft)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.2)', transition: 'all var(--transition-fast)' }}
                onClick={() => markBlock('skipped')}
              >
                <XCircle size={15} /> Skipped
              </button>
            </div>
          </div>
        ) : (
          /* Score card */
          <div className="p-6 text-center">
            <Trophy size={28} className="mx-auto mb-2" style={{ color: 'var(--primary)' }} />
            <div className="text-lg font-extrabold tracking-tight mb-0.5" style={{ color: 'var(--text)' }}>
              Day Complete
            </div>
            <div className="text-[11px] mb-5" style={{ color: 'var(--text-muted)' }}>
              {new Date(dayData.date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </div>

            {/* Score ring */}
            <div className="relative w-28 h-28 mx-auto mb-5">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="6" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke={stats.rate >= 80 ? 'var(--success)' : stats.rate >= 50 ? 'var(--warning)' : 'var(--error)'}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${(stats.rate / 100) * 314} 314`}
                  style={{ transition: 'stroke-dasharray 800ms ease-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black" style={{ color: 'var(--text)' }}>{stats.rate}%</span>
                <span className="text-[8px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>completed</span>
              </div>
            </div>

            {/* Category results */}
            <div className="space-y-2 mb-5 text-left max-w-[300px] mx-auto">
              {Object.entries(stats.byCat).map(([catId, { total, done }]) => {
                const cat = getCat(catId)
                const pct = total > 0 ? (done / total) * 100 : 0
                return (
                  <div key={catId} className="flex items-center gap-2.5">
                    <span className="w-[65px] text-right text-[11px] font-semibold" style={{ color: cat?.color }}>{cat?.name}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cat?.color, transition: 'width 600ms ease-out' }} />
                    </div>
                    <span className="w-9 text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{formatDuration(done)}</span>
                  </div>
                )
              })}
            </div>

            {/* Streak */}
            <div
              className="rounded-xl p-3 mb-5 max-w-[300px] mx-auto inline-flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(99,102,241,0.03))',
                border: '1px solid rgba(168,85,247,0.15)',
              }}
            >
              <Flame size={16} style={{ color: 'var(--secondary)' }} />
              <span className="text-sm font-extrabold text-gradient">{settings.streak + 1} days</span>
              {settings.bestStreak > 0 && (
                <span className="text-[9px] ml-1" style={{ color: 'var(--text-faint)' }}>Best: {settings.bestStreak}</span>
              )}
            </div>

            <div>
              <button type="button" onClick={handleSave} className="kd-btn kd-btn-primary px-8 py-2.5">
                Save & Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
