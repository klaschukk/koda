import { useState } from 'react'
import { Plus, Trash2, Layers, Pencil, X, Clock } from 'lucide-react'
import type { AppSettings, Template } from '../../shared/types'
import { v4 as uuid } from 'uuid'
import { timeToMinutes, formatDuration } from '../../shared/utils'

interface Props {
  settings: AppSettings
  onChange: (templates: Template[]) => void
}

export default function TemplatesEditor({ settings, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const templates = settings.templates ?? []

  const addTemplate = (t: Template) => {
    onChange([...templates, t])
    setEditingId(t.id)
    setShowNew(false)
  }

  const updateTemplate = (id: string, changes: Partial<Template>) => {
    onChange(templates.map(t => t.id === id ? { ...t, ...changes } : t))
  }

  const removeTemplate = (id: string) => {
    onChange(templates.filter(t => t.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const editing = editingId ? templates.find(t => t.id === editingId) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="kd-label">Your Templates ({templates.length})</div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="kd-btn kd-btn-outline text-[11px] h-7"
        >
          <Plus size={13} /> New Template
        </button>
      </div>

      {templates.length === 0 && !showNew && (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: 'var(--elevated)', border: '1px dashed var(--border)' }}
        >
          <Layers size={20} className="mx-auto mb-2" style={{ color: 'var(--text-faint)' }} />
          <div className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
            No templates yet
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
            Templates let you apply a set of blocks to any day with one click.
          </div>
        </div>
      )}

      <div className="space-y-2">
        {templates.map(t => {
          const totalMins = t.blocks.reduce(
            (s, b) => s + (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)), 0
          )
          return (
            <div
              key={t.id}
              className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--primary-soft)', color: 'var(--primary-light)' }}
              >
                <Layers size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold truncate" style={{ color: 'var(--text)' }}>
                  {t.name || 'Untitled'}
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {t.blocks.length} block{t.blocks.length === 1 ? '' : 's'} · {formatDuration(totalMins)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingId(t.id)}
                className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                style={{
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  transition: 'all var(--transition-fast)',
                }}
                aria-label="Edit template"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={() => removeTemplate(t.id)}
                className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                style={{
                  background: 'transparent',
                  color: 'var(--error)',
                  transition: 'all var(--transition-fast)',
                  opacity: 0.5,
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                aria-label="Delete template"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
      </div>

      {showNew && (
        <NewTemplateForm
          onCreate={addTemplate}
          onCancel={() => setShowNew(false)}
        />
      )}

      {editing && (
        <TemplateEditModal
          template={editing}
          settings={settings}
          onSave={changes => updateTemplate(editing.id, changes)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}

// ── New template form (inline) ──
function NewTemplateForm({
  onCreate,
  onCancel,
}: {
  onCreate: (t: Template) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')

  const handleCreate = () => {
    if (!name.trim()) return
    onCreate({ id: uuid(), name: name.trim(), blocks: [] })
  }

  return (
    <div
      className="mt-3 p-4 rounded-xl animate-slide-down"
      style={{ background: 'var(--elevated)', border: '1px solid var(--primary)' }}
    >
      <div className="text-[11px] font-semibold mb-2" style={{ color: 'var(--text)' }}>New Template</div>
      <input
        autoFocus
        aria-label="Template name"
        className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none mb-2"
        style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
        placeholder="e.g. Morning Routine"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onCancel() }}
      />
      <div className="flex gap-2">
        <button type="button" onClick={handleCreate} className="kd-btn kd-btn-outline flex-1 text-[11px]">Create</button>
        <button type="button" onClick={onCancel} className="kd-btn kd-btn-ghost text-[11px]">Cancel</button>
      </div>
    </div>
  )
}

// ── Edit template modal ──
function TemplateEditModal({
  template, settings, onSave, onClose,
}: {
  template: Template
  settings: AppSettings
  onSave: (changes: Partial<Template>) => void
  onClose: () => void
}) {
  const [t, setT] = useState<Template>(template)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCat, setNewCat] = useState(settings.categories[0]?.id ?? 'other')
  const [newStart, setNewStart] = useState('09:00')
  const [newEnd, setNewEnd] = useState('10:00')

  const update = (changes: Partial<Template>) => {
    const next = { ...t, ...changes }
    setT(next)
    onSave(changes)
  }

  const addBlock = () => {
    if (!newTitle.trim()) return
    if (timeToMinutes(newEnd) - timeToMinutes(newStart) < 15) return
    const blocks = [...t.blocks, {
      title: newTitle.trim(),
      categoryId: newCat,
      startTime: newStart,
      endTime: newEnd,
    }].sort((a, b) => a.startTime.localeCompare(b.startTime))
    update({ blocks })
    setNewTitle(''); setAdding(false)
  }

  const removeBlock = (idx: number) => {
    update({ blocks: t.blocks.filter((_, i) => i !== idx) })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit template ${t.name}`}
    >
      <div
        className="w-[480px] max-h-[80vh] rounded-2xl overflow-hidden flex flex-col animate-slide-up"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
          <Layers size={16} style={{ color: 'var(--primary-light)' }} />
          <input
            aria-label="Template name"
            className="flex-1 bg-transparent border-none outline-none text-base font-bold"
            style={{ color: 'var(--text)' }}
            value={t.name}
            onChange={e => update({ name: e.target.value })}
          />
          <button
            type="button" onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ color: 'var(--text-muted)' }} aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="kd-label mb-2.5">Blocks ({t.blocks.length})</div>
          <div className="space-y-1.5 mb-3">
            {t.blocks.map((b, i) => {
              const cat = settings.categories.find(c => c.id === b.categoryId)
              const color = cat?.color ?? '#64748b'
              return (
                <div
                  key={i}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                  style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}
                >
                  <div className="w-1 h-6 rounded-full" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {b.title}
                    </div>
                    <div className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {b.startTime} → {b.endTime} · {cat?.name}
                    </div>
                  </div>
                  <button
                    type="button" onClick={() => removeBlock(i)}
                    className="w-6 h-6 rounded flex items-center justify-center cursor-pointer opacity-50 hover:opacity-100"
                    style={{ color: 'var(--error)', transition: 'opacity var(--transition-fast)' }}
                    aria-label="Remove block"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )
            })}
            {t.blocks.length === 0 && !adding && (
              <div className="text-[11px] py-4 text-center" style={{ color: 'var(--text-faint)' }}>
                No blocks. Add one to get started.
              </div>
            )}
          </div>

          {adding ? (
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--elevated)', border: '1px solid var(--primary)' }}>
              <input
                autoFocus
                aria-label="Block title"
                className="w-full px-2.5 py-1.5 rounded text-[12px] bg-transparent outline-none"
                style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
                placeholder="Title..."
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
              />
              <div className="flex gap-1.5 flex-wrap">
                {settings.categories.map(cat => (
                  <button
                    key={cat.id} type="button"
                    onClick={() => setNewCat(cat.id)}
                    className="px-2 py-1 rounded text-[10px] font-semibold cursor-pointer"
                    style={{
                      background: newCat === cat.id ? `${cat.color}20` : 'transparent',
                      color: newCat === cat.id ? cat.color : 'var(--text-muted)',
                      border: `1px solid ${newCat === cat.id ? cat.color : 'var(--border)'}`,
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Clock size={12} style={{ color: 'var(--text-faint)' }} />
                <input
                  type="time" aria-label="Start time"
                  className="px-2 py-1 rounded text-[11px] font-mono"
                  style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  value={newStart} onChange={e => setNewStart(e.target.value)}
                />
                <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>→</span>
                <input
                  type="time" aria-label="End time"
                  className="px-2 py-1 rounded text-[11px] font-mono"
                  style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  value={newEnd} onChange={e => setNewEnd(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={addBlock} className="kd-btn kd-btn-outline flex-1 text-[11px]">Add Block</button>
                <button type="button" onClick={() => setAdding(false)} className="kd-btn kd-btn-ghost text-[11px]">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="kd-btn kd-btn-outline w-full text-[11px]"
            >
              <Plus size={13} /> Add Block to Template
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
