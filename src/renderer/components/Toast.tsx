import React, { useEffect, useState } from 'react'
import { Bell, Clock, AlertTriangle, Coffee, X, Undo2, Redo2 } from 'lucide-react'

export interface ToastData {
  id: string
  type: 'block-starting' | 'block-ending' | 'block-overtime' | 'idle' | 'undo' | 'redo'
  title: string
  body: string
  color: string
  action?: {
    label: string
    onClick: () => void
  }
}

interface Props {
  toasts: ToastData[]
  onDismiss: (id: string) => void
}

const ICONS = {
  'block-starting': Bell,
  'block-ending': Clock,
  'block-overtime': AlertTriangle,
  'idle': Coffee,
  'undo': Undo2,
  'redo': Redo2,
}

const AUTO_DISMISS_MS = 6000

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false)
  const Icon = ICONS[toast.type]

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(onDismiss, 200)
    }, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className={`flex items-start gap-3 p-3.5 rounded-xl w-[340px] ${exiting ? 'animate-slide-out' : 'animate-slide-in-right'}`}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${toast.color}33`,
        boxShadow: `var(--shadow-lg), 0 0 20px ${toast.color}10`,
      }}
      role="alert"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${toast.color}15`, color: toast.color }}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-bold" style={{ color: 'var(--text)' }}>
          {toast.title}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {toast.body}
        </div>
        {toast.action && (
          <button
            type="button"
            onClick={() => { toast.action!.onClick(); setExiting(true); setTimeout(onDismiss, 200) }}
            className="mt-2 px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer"
            style={{
              background: `${toast.color}18`,
              color: toast.color,
              border: `1px solid ${toast.color}44`,
              transition: 'all var(--transition-fast)',
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 cursor-pointer opacity-40 hover:opacity-100"
        style={{ color: 'var(--text-muted)', transition: 'opacity var(--transition-fast)' }}
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  )
}

export default function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-12 right-4 z-40 flex flex-col gap-2">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  )
}
