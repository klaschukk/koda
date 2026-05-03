import { useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts'

interface Props {
  onClose: () => void
}

const GROUPS = [
  { id: 'actions', label: 'Actions' },
  { id: 'editing', label: 'Editing' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'general', label: 'General' },
] as const

export default function ShortcutsModal({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-[480px] rounded-2xl overflow-hidden animate-slide-up"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <Keyboard size={16} style={{ color: 'var(--primary-light)' }} />
            <span className="text-base font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>Keyboard Shortcuts</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ color: 'var(--text-muted)', transition: 'color var(--transition-fast)' }}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Groups */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {GROUPS.map(group => {
            const items = SHORTCUTS.filter(s => s.group === group.id)
            if (items.length === 0) return null
            return (
              <div key={group.id}>
                <div className="kd-label mb-2.5">{group.label}</div>
                <div className="space-y-1">
                  {items.map(s => (
                    <div
                      key={s.keys}
                      className="flex items-center justify-between py-2 px-3 rounded-lg"
                      style={{ background: 'var(--elevated)' }}
                    >
                      <span className="text-[12px] font-medium" style={{ color: 'var(--text)' }}>{s.label}</span>
                      <kbd
                        className="px-2 py-1 rounded text-[11px] font-mono font-semibold"
                        style={{
                          background: 'var(--surface)',
                          color: 'var(--text)',
                          border: '1px solid var(--border)',
                          minWidth: '32px',
                          textAlign: 'center',
                        }}
                      >
                        {s.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t text-center" style={{ borderColor: 'var(--border)' }}>
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>
            Press <kbd className="font-mono px-1 py-px rounded" style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>?</kbd> anytime to show this
          </span>
        </div>
      </div>
    </div>
  )
}
