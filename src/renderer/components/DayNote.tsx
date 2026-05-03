import { useState, useEffect, useRef } from 'react'
import { FileText, Check } from 'lucide-react'

interface Props {
  /** Current note value (or undefined) */
  value: string | undefined
  /** Called with new note (debounced via parent saveDayData) */
  onChange: (note: string) => void
  /** Compact: small inline; expanded: bigger block */
  compact?: boolean
}

const MAX_LEN = 2000

/**
 * Daily journal-style note. Auto-saves on blur.
 * Used in Dashboard and Sidebar.
 */
export default function DayNote({ value, onChange, compact = false }: Props) {
  const [draft, setDraft] = useState(value ?? '')
  const [saved, setSaved] = useState(false)
  const lastSaved = useRef(value ?? '')

  // Sync external changes (e.g. day switch) into draft
  useEffect(() => {
    setDraft(value ?? '')
    lastSaved.current = value ?? ''
    setSaved(false)
  }, [value])

  const handleBlur = () => {
    const next = draft.trim()
    if (next === lastSaved.current.trim()) return
    onChange(next)
    lastSaved.current = next
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  if (compact) {
    return (
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="kd-label">Day Note</div>
          {saved && (
            <span className="inline-flex items-center gap-1 text-[9px]" style={{ color: 'var(--success)' }}>
              <Check size={9} /> Saved
            </span>
          )}
        </div>
        <textarea
          aria-label="Day note"
          className="w-full bg-transparent border-none outline-none resize-none text-[11px]"
          style={{ color: 'var(--text)', minHeight: '60px', lineHeight: '1.5', fontFamily: 'inherit' }}
          placeholder="Today's mood, intention, or anything to remember…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          maxLength={MAX_LEN}
        />
      </div>
    )
  }

  return (
    <div
      className="kd-card rounded-2xl p-5 mb-5"
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <FileText size={13} style={{ color: 'var(--primary-light)' }} />
          <div className="kd-label">Day Note</div>
        </div>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--success)' }}>
            <Check size={10} /> Saved
          </span>
        )}
      </div>
      <textarea
        aria-label="Day note"
        className="w-full bg-transparent border-none outline-none resize-none text-[13px]"
        style={{ color: 'var(--text)', minHeight: '80px', lineHeight: '1.55', fontFamily: 'inherit' }}
        placeholder="What's on your mind? How are you feeling? What's the goal of today?"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleBlur}
        maxLength={MAX_LEN}
      />
      <div className="flex justify-end text-[9px] mt-1" style={{ color: 'var(--text-faint)' }}>
        {draft.length}/{MAX_LEN}
      </div>
    </div>
  )
}
