import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Filter, Calendar, Check, Circle } from 'lucide-react'
import type { AppSettings, DayData, TimeBlock } from '../../shared/types'

interface Props {
  settings: AppSettings
  onClose: () => void
  onSelect: (date: string, blockId: string) => void
}

interface SearchResult {
  date: string
  block: TimeBlock
}

type CompletionFilter = 'all' | 'done' | 'incomplete'

export default function SearchBar({ settings, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [allDays, setAllDays] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load all days once
  useEffect(() => {
    let cancelled = false
    window.api.getAllDays().then(days => {
      if (cancelled) return
      setAllDays(days)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Build search index by date for O(1) lookup of block→date
  const blocksByDate = useMemo(() => {
    const m = new Map<string, TimeBlock[]>()
    for (const day of allDays) {
      m.set(day.date, day.blocks)
    }
    return m
  }, [allDays])

  // Filter & search results
  const results = useMemo<SearchResult[]>(() => {
    if (loading) return []
    const q = query.trim().toLowerCase()
    const out: SearchResult[] = []
    // search latest first
    const sorted = [...allDays].sort((a, b) => b.date.localeCompare(a.date))
    for (const day of sorted) {
      for (const block of day.blocks) {
        if (q && !block.title.toLowerCase().includes(q)) continue
        if (categoryFilter && block.categoryId !== categoryFilter) continue
        if (completionFilter === 'done' && block.completed !== 'done') continue
        if (completionFilter === 'incomplete' && block.completed === 'done') continue
        out.push({ date: day.date, block })
        if (out.length >= 100) break
      }
      if (out.length >= 100) break
    }
    return out
  }, [query, allDays, blocksByDate, categoryFilter, completionFilter, loading])

  // Reset selected index when results shift
  useEffect(() => { setActiveIdx(0) }, [query, categoryFilter, completionFilter])

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const r = results[activeIdx]
        if (r) onSelect(r.date, r.block.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [results, activeIdx, onClose, onSelect])

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const formatDate = (date: string) => {
    const d = new Date(date + 'T12:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(date + 'T00:00:00')
    const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === -1) return 'Yesterday'
    if (diff === 1) return 'Tomorrow'
    if (Math.abs(diff) < 7) {
      return d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' +
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search blocks"
    >
      <div
        className="w-[560px] rounded-2xl overflow-hidden animate-slide-up flex flex-col max-h-[70vh]"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
          <Search size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            aria-label="Search blocks"
            className="flex-1 bg-transparent border-none outline-none text-sm font-semibold"
            style={{ color: 'var(--text)' }}
            placeholder="Search blocks across all days..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd
            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: 'var(--elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            Esc
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer flex-shrink-0"
            style={{ color: 'var(--text-muted)', transition: 'color var(--transition-fast)' }}
            aria-label="Close search"
          >
            <X size={15} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-2 border-b flex items-center gap-2 flex-wrap" style={{ borderColor: 'var(--border)' }}>
          <Filter size={11} style={{ color: 'var(--text-faint)' }} />
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            className="px-2.5 py-1 rounded-md text-[10px] font-semibold cursor-pointer"
            style={{
              background: categoryFilter === null ? 'var(--primary-soft)' : 'var(--elevated)',
              color: categoryFilter === null ? 'var(--primary-light)' : 'var(--text-muted)',
              border: `1px solid ${categoryFilter === null ? 'var(--primary)' : 'var(--border)'}`,
              transition: 'all var(--transition-fast)',
            }}
          >
            All
          </button>
          {settings.categories.map(cat => {
            const active = categoryFilter === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(active ? null : cat.id)}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold cursor-pointer"
                style={{
                  background: active ? `${cat.color}20` : 'var(--elevated)',
                  color: active ? cat.color : 'var(--text-muted)',
                  border: `1px solid ${active ? cat.color : 'var(--border)'}`,
                  transition: 'all var(--transition-fast)',
                }}
              >
                {cat.name}
              </button>
            )
          })}

          <div className="ml-auto flex gap-1">
            {(['all', 'done', 'incomplete'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setCompletionFilter(f)}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold capitalize cursor-pointer"
                style={{
                  background: completionFilter === f ? 'var(--primary-soft)' : 'transparent',
                  color: completionFilter === f ? 'var(--primary-light)' : 'var(--text-muted)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : results.length === 0 ? (
            <div className="py-10 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
              {query.trim() || categoryFilter || completionFilter !== 'all'
                ? 'No results'
                : 'Type to search across all your days'}
            </div>
          ) : (
            results.map((r, i) => {
              const cat = settings.categories.find(c => c.id === r.block.categoryId)
              const color = cat?.color ?? '#64748b'
              const active = i === activeIdx
              return (
                <button
                  key={`${r.date}-${r.block.id}`}
                  data-idx={i}
                  type="button"
                  onClick={() => onSelect(r.date, r.block.id)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 text-left cursor-pointer"
                  style={{
                    background: active ? 'var(--elevated)' : 'transparent',
                    borderLeft: `2px solid ${active ? color : 'transparent'}`,
                    transition: 'background var(--transition-fast)',
                  }}
                >
                  <div
                    className="w-1.5 h-8 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                        {r.block.title}
                      </span>
                      {r.block.completed === 'done' && (
                        <Check size={11} style={{ color: 'var(--success)' }} />
                      )}
                      {r.block.completed === 'skipped' && (
                        <Circle size={11} style={{ color: 'var(--error)' }} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      <Calendar size={9} />
                      <span>{formatDate(r.date)}</span>
                      <span>·</span>
                      <span>{r.block.startTime} → {r.block.endTime}</span>
                      <span>·</span>
                      <span style={{ color }}>{cat?.name}</span>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2 border-t flex items-center justify-between text-[9px] font-mono"
          style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}
        >
          <div className="flex gap-3">
            <span><kbd style={{ background: 'var(--elevated)', padding: '1px 4px', borderRadius: '3px' }}>↑↓</kbd> navigate</span>
            <span><kbd style={{ background: 'var(--elevated)', padding: '1px 4px', borderRadius: '3px' }}>↵</kbd> open</span>
          </div>
          <span>{results.length} result{results.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  )
}
