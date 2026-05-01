import React, { useState, useRef, useEffect } from 'react'
import { X, Clock, Plus, FileText, ChevronDown, Layers } from 'lucide-react'
import type { AppSettings, TimeBlock, Template } from '../../shared/types'
import { timeToMinutes, formatDuration } from '../../shared/utils'

interface Props {
  settings: AppSettings
  onAdd: (block: Omit<TimeBlock, 'id' | 'completed'>) => void
  onApplyTemplate?: (template: Template) => void
  onClose: () => void
}

function nowTimeRounded(): string {
  const now = new Date()
  const mins = Math.ceil(now.getMinutes() / 15) * 15
  const h = now.getHours() + Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function QuickAdd({ settings, onAdd, onApplyTemplate, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState(settings.defaultCategoryId ?? settings.categories[0]?.id ?? 'other')
  const [startTime, setStartTime] = useState(nowTimeRounded())
  const [endTime, setEndTime] = useState(addHour(nowTimeRounded()))
  const [showNotes, setShowNotes] = useState(false)
  const [note, setNote] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Focus notes textarea when revealed
  useEffect(() => {
    if (showNotes) noteRef.current?.focus()
  }, [showNotes])

  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (!title.trim()) { setError('Enter a title'); return }
    if (startTime >= endTime) { setError('End time must be after start'); return }
    setError('')
    onAdd({
      title: title.trim(),
      categoryId,
      startTime,
      endTime,
      ...(note.trim() ? { note: note.trim() } : {}),
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Quick add block"
    >
      <div
        className="w-[440px] max-h-[90vh] flex flex-col rounded-2xl overflow-hidden animate-slide-up"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
          <Plus size={18} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            aria-label="Block title"
            className="w-full bg-transparent border-none outline-none text-base font-semibold"
            style={{ color: 'var(--text)' }}
            placeholder="What are you working on?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer flex-shrink-0"
            style={{ color: 'var(--text-muted)', transition: 'all var(--transition-fast)' }}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Categories */}
        <div className="px-5 py-3 flex gap-2 flex-wrap border-b" style={{ borderColor: 'var(--border)' }}>
          {settings.categories.map(cat => {
            const active = categoryId === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer"
                style={{
                  background: `${cat.color}${active ? '20' : '0a'}`,
                  color: cat.color,
                  border: `1px solid ${active ? `${cat.color}55` : 'transparent'}`,
                  boxShadow: active ? `0 0 12px ${cat.color}10` : 'none',
                  transition: 'all var(--transition-fast)',
                }}
                onClick={() => setCategoryId(cat.id)}
              >
                {cat.name}
              </button>
            )
          })}
        </div>

        {/* Time */}
        <div className="px-5 py-3 flex items-center gap-3">
          <Clock size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <input
            type="time"
            aria-label="Start time"
            className="px-2.5 py-1.5 rounded-lg text-sm font-mono text-center"
            style={{ background: 'var(--elevated)', color: 'var(--text)', border: '1px solid var(--border)', transition: 'border-color var(--transition-fast)' }}
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
          />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-faint)' }}>→</span>
          <input
            type="time"
            aria-label="End time"
            className="px-2.5 py-1.5 rounded-lg text-sm font-mono text-center"
            style={{ background: 'var(--elevated)', color: 'var(--text)', border: '1px solid var(--border)', transition: 'border-color var(--transition-fast)' }}
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
          />
          <button
            type="button"
            className="ml-auto px-2.5 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer"
            style={{ background: 'var(--elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)', transition: 'all var(--transition-fast)' }}
            onClick={() => { setStartTime(nowTimeRounded()); setEndTime(addHour(nowTimeRounded())) }}
          >
            Now + 1h
          </button>
        </div>

        {/* Notes toggle */}
        <button
          type="button"
          onClick={() => setShowNotes(v => !v)}
          className="w-full px-5 py-2.5 flex items-center gap-2 cursor-pointer border-t text-[11px] font-semibold"
          style={{
            borderColor: 'var(--border)',
            color: showNotes ? 'var(--primary-light)' : 'var(--text-muted)',
            background: showNotes ? 'var(--primary-soft)' : 'transparent',
            transition: 'all var(--transition-fast)',
          }}
          aria-expanded={showNotes ? 'true' : 'false'}
        >
          <FileText size={12} />
          <span>Notes {note.trim() ? `(${note.trim().length})` : ''}</span>
          <ChevronDown
            size={12}
            style={{
              marginLeft: 'auto',
              transform: showNotes ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform var(--transition-fast)',
            }}
          />
        </button>

        {showNotes && (
          <div className="px-5 py-3 border-t animate-slide-down" style={{ borderColor: 'var(--border)' }}>
            <textarea
              ref={noteRef}
              aria-label="Block notes"
              className="w-full bg-transparent border-none outline-none resize-none text-[12px]"
              style={{ color: 'var(--text)', minHeight: '64px', fontFamily: 'inherit', lineHeight: '1.5' }}
              placeholder="Optional notes — context, links, or anything to remember..."
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={e => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              maxLength={1000}
            />
          </div>
        )}

        {/* Templates picker */}
        {(settings.templates ?? []).length > 0 && (
          <div className="border-t flex-shrink-0 max-h-[180px] overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
            <div className="px-5 py-2.5">
              <div className="kd-label mb-2 flex items-center gap-1.5">
                <Layers size={11} /> Templates
              </div>
              <div className="space-y-1.5">
                {(settings.templates ?? []).map(t => {
                  const totalMins = t.blocks.reduce(
                    (s, b) => s + (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)), 0
                  )
                  const single = t.blocks.length === 1
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                      style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}
                    >
                      <Layers size={11} style={{ color: 'var(--primary-light)', flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                          {t.name}
                        </div>
                        <div className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
                          {t.blocks.length} block{t.blocks.length === 1 ? '' : 's'} · {formatDuration(totalMins)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (single) {
                            const b = t.blocks[0]
                            setTitle(b.title)
                            setCategoryId(b.categoryId)
                            setStartTime(b.startTime)
                            setEndTime(b.endTime)
                          } else if (onApplyTemplate) {
                            onApplyTemplate(t)
                            onClose()
                          }
                        }}
                        className="px-2 py-1 rounded text-[10px] font-bold cursor-pointer"
                        style={{ background: 'var(--primary-soft)', color: 'var(--primary-light)', border: '1px solid var(--primary)' }}
                        title={single ? 'Copy to form' : 'Apply all blocks to current day'}
                      >
                        {single ? 'Use' : 'Apply all'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="px-5 py-4 flex justify-between items-center border-t" style={{ borderColor: 'var(--border)' }}>
          {error ? (
            <span className="text-[11px] font-medium" style={{ color: 'var(--error)' }}>{error}</span>
          ) : (
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>⌘ Enter to submit</span>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            className="kd-btn kd-btn-primary px-5 py-2"
          >
            Add Block
          </button>
        </div>
      </div>
    </div>
  )
}
