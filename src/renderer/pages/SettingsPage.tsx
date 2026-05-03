import React, { useState, useEffect } from 'react'
import {
  Moon, Sun, Plus, Trash2, Check, Copy, Bell, Volume2,
  Palette, Clock, Target, LayoutDashboard, Keyboard, Zap, Flame, Layers, Timer,
  RotateCcw, HardDrive,
} from 'lucide-react'
import type { AppSettings, Category, SoundPack } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'
import { v4 as uuid } from 'uuid'
import TemplatesEditor from '../components/TemplatesEditor'

interface Props {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

const COLOR_OPTIONS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#38bdf8', '#6366f1', '#a855f7', '#ec4899', '#64748b',
]

const ICON_OPTIONS = [
  '💻', '🇬🇧', '🎬', '🏃', '😴', '📌', '🎸', '📚', '🎨', '🎧',
  '✍️', '🧘', '🍳', '🛠', '🎯', '🧠', '📱', '🎮', '🏠', '☕',
]

type SettingsTab = 'appearance' | 'timeline' | 'categories' | 'templates' | 'pomodoro' | 'notifications' | 'productivity' | 'shortcuts' | 'data'

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'appearance',     label: 'Appearance',     icon: <Palette size={14} /> },
  { id: 'timeline',       label: 'Timeline',       icon: <Clock size={14} /> },
  { id: 'categories',     label: 'Categories',     icon: <LayoutDashboard size={14} /> },
  { id: 'templates',      label: 'Templates',      icon: <Layers size={14} /> },
  { id: 'pomodoro',       label: 'Pomodoro',       icon: <Timer size={14} /> },
  { id: 'notifications',  label: 'Notifications',  icon: <Bell size={14} /> },
  { id: 'productivity',   label: 'Productivity',   icon: <Target size={14} /> },
  { id: 'shortcuts',      label: 'Shortcuts',      icon: <Keyboard size={14} /> },
  { id: 'data',           label: 'Data',           icon: <Zap size={14} /> },
]

// ── Reusable controls ──
function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{label}</div>
        {hint && <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-9 h-5 rounded-full cursor-pointer flex-shrink-0"
        style={{
          background: checked ? 'var(--primary)' : 'var(--border)',
          transition: 'background var(--transition-fast)',
        }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
          style={{
            left: checked ? '18px' : '2px',
            transition: 'left var(--transition-fast)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        />
      </button>
    </div>
  )
}

function Slider({ value, min, max, step, onChange, label, valueLabel }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
  label: string; valueLabel?: string
}) {
  return (
    <div className="py-3">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
        <span className="text-[12px] font-mono" style={{ color: 'var(--primary-light)' }}>{valueLabel ?? value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step ?? 1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full h-1.5 rounded-full cursor-pointer appearance-none"
        style={{ accentColor: 'var(--primary)' }}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="kd-label mb-2.5">{title}</div>
      <div className="kd-card rounded-xl divide-y" style={{ borderColor: 'var(--border)' }}>
        {React.Children.map(children, (child, i) => (
          <div key={i} className="px-4" style={{ borderColor: 'var(--border)' }}>{child}</div>
        ))}
      </div>
    </div>
  )
}

export default function SettingsPage({ settings, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')
  const [s, setS] = useState<AppSettings>({ ...settings })
  const [editingIcon, setEditingIcon] = useState<string | null>(null)
  const [showAddCat, setShowAddCat] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📌')
  const [newColor, setNewColor] = useState('#6366f1')
  const [saved, setSaved] = useState(false)
  const [dataStats, setDataStats] = useState<{ bytes: number; daysCount: number } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  // Load data stats when Data tab is active
  useEffect(() => {
    if (activeTab === 'data') {
      window.api.getDataStats?.()?.then(setDataStats).catch(() => {})
    }
  }, [activeTab])

  const formatBytes = (b: number): string => {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / 1024 / 1024).toFixed(2)} MB`
  }

  const handleResetSettings = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 4000)
      return
    }
    // Preserve user's actual day data (categories, templates) — only reset preferences
    const reset: AppSettings = {
      ...DEFAULT_SETTINGS,
      categories: s.categories,    // keep custom categories
      templates: s.templates,      // keep templates
      streak: s.streak,            // keep streak
      bestStreak: s.bestStreak,
      lastActiveDate: s.lastActiveDate,
    }
    setS(reset)
    onSave(reset)
    setConfirmReset(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setS(prev => ({ ...prev, [key]: value }))
  }
  const updateNotif = <K extends keyof AppSettings['notifications']>(key: K, value: AppSettings['notifications'][K]) => {
    setS(prev => ({ ...prev, notifications: { ...prev.notifications, [key]: value } }))
  }

  const handleSave = () => {
    onSave(s)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addCategory = () => {
    if (!newName.trim()) return
    update('categories', [...s.categories, { id: uuid(), name: newName.trim(), icon: newIcon, color: newColor }])
    setNewName(''); setShowAddCat(false)
  }
  const removeCategory = (id: string) => update('categories', s.categories.filter(c => c.id !== id))
  const updateCategory = (id: string, changes: Partial<Category>) =>
    update('categories', s.categories.map(c => c.id === id ? { ...c, ...changes } : c))

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Tabs sidebar */}
      <div
        className="w-[180px] flex-shrink-0 border-r overflow-y-auto py-4"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="px-4 mb-4">
          <h1 className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>Settings</h1>
        </div>
        <nav className="px-2 space-y-0.5">
          {TABS.map(t => {
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-semibold cursor-pointer text-left"
                style={{
                  background: active ? 'var(--primary-soft)' : 'transparent',
                  color: active ? 'var(--primary-light)' : 'var(--text-muted)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <span style={{ color: active ? 'var(--primary-light)' : 'var(--text-muted)' }}>{t.icon}</span>
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[640px] mx-auto p-8 animate-fade-in">
          {/* Header with save */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
                {TABS.find(t => t.id === activeTab)?.label}
              </div>
              <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                {activeTab === 'appearance' && 'Visual style and theme preferences'}
                {activeTab === 'timeline' && 'Time range and timeline behavior'}
                {activeTab === 'categories' && 'Manage your activity categories'}
                {activeTab === 'templates' && 'Reusable sets of blocks for any day'}
                {activeTab === 'pomodoro' && 'Work / break cycle preferences'}
                {activeTab === 'notifications' && 'When to be notified'}
                {activeTab === 'productivity' && 'Daily goals and tracking'}
                {activeTab === 'shortcuts' && 'Keyboard shortcuts reference'}
                {activeTab === 'data' && 'Storage and streak info'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              className="kd-btn px-5 py-2 cursor-pointer"
              style={{
                background: saved ? 'var(--success)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                color: 'white',
                boxShadow: saved ? 'none' : '0 2px 12px rgba(99,102,241,0.25)',
                transition: 'all var(--transition-normal)',
              }}
            >
              {saved ? <><Check size={14} /> Saved</> : 'Save Changes'}
            </button>
          </div>

          {/* ── APPEARANCE ── */}
          {activeTab === 'appearance' && (
            <>
              <Section title="Theme">
                <div className="py-3">
                  <div className="flex gap-3">
                    {[
                      { t: 'dark' as const, icon: <Moon size={20} />, label: 'Dark Mode', sub: 'Midnight Neon' },
                      { t: 'light' as const, icon: <Sun size={20} />, label: 'Light Mode', sub: 'Clean & Bright' },
                    ].map(({ t, icon, label, sub }) => (
                      <button
                        key={t} type="button"
                        onClick={() => update('theme', t)}
                        className="flex-1 p-4 rounded-xl cursor-pointer text-left"
                        style={{
                          background: s.theme === t ? 'var(--primary-soft)' : 'var(--elevated)',
                          border: `2px solid ${s.theme === t ? 'var(--primary)' : 'var(--border)'}`,
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        <div className="mb-2" style={{ color: s.theme === t ? 'var(--primary-light)' : 'var(--text-muted)' }}>{icon}</div>
                        <div className="text-[13px] font-bold" style={{ color: s.theme === t ? 'var(--primary-light)' : 'var(--text)' }}>{label}</div>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </Section>
              <Section title="Density">
                <Toggle
                  checked={s.compactMode}
                  onChange={v => update('compactMode', v)}
                  label="Compact Mode"
                  hint="Reduce spacing for more content per screen"
                />
                <Slider
                  value={s.hourHeight}
                  min={48} max={120} step={4}
                  onChange={v => update('hourHeight', v)}
                  label="Timeline Hour Height"
                  valueLabel={`${s.hourHeight}px`}
                />
              </Section>
            </>
          )}

          {/* ── TIMELINE ── */}
          {activeTab === 'timeline' && (
            <>
              <Section title="Visible Hours">
                <div className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label htmlFor="ts" className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-faint)' }}>Start</label>
                      <select
                        id="ts"
                        className="w-full px-3 py-2 rounded-lg text-[13px] font-mono appearance-none cursor-pointer"
                        style={{ background: 'var(--elevated)', color: 'var(--text)', border: '1px solid var(--border)' }}
                        value={s.timelineStart}
                        onChange={e => update('timelineStart', Number(e.target.value))}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 4).map(h => (
                          <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                    <span className="text-base font-bold mt-4" style={{ color: 'var(--text-faint)' }}>→</span>
                    <div className="flex-1">
                      <label htmlFor="te" className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-faint)' }}>End</label>
                      <select
                        id="te"
                        className="w-full px-3 py-2 rounded-lg text-[13px] font-mono appearance-none cursor-pointer"
                        style={{ background: 'var(--elevated)', color: 'var(--text)', border: '1px solid var(--border)' }}
                        value={s.timelineEnd}
                        onChange={e => update('timelineEnd', Number(e.target.value))}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 16).map(h => (
                          <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </Section>
              <Section title="Defaults">
                <Slider
                  value={s.defaultBlockDuration}
                  min={15} max={240} step={15}
                  onChange={v => update('defaultBlockDuration', v)}
                  label="Default Block Duration"
                  valueLabel={s.defaultBlockDuration < 60 ? `${s.defaultBlockDuration}m` : `${Math.floor(s.defaultBlockDuration / 60)}h${s.defaultBlockDuration % 60 ? ` ${s.defaultBlockDuration % 60}m` : ''}`}
                />
                <div className="py-3">
                  <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text)' }}>Default Category</div>
                  <div className="flex flex-wrap gap-2">
                    {s.categories.map(cat => (
                      <button
                        key={cat.id} type="button"
                        onClick={() => update('defaultCategoryId', cat.id)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer"
                        style={{
                          background: s.defaultCategoryId === cat.id ? `${cat.color}25` : 'var(--elevated)',
                          color: s.defaultCategoryId === cat.id ? cat.color : 'var(--text-muted)',
                          border: `1px solid ${s.defaultCategoryId === cat.id ? `${cat.color}55` : 'var(--border)'}`,
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>
              <Section title="Display">
                <Toggle
                  checked={s.showCompletedBlocks}
                  onChange={v => update('showCompletedBlocks', v)}
                  label="Show Completed Blocks"
                  hint="Display checkmarks on done blocks"
                />
              </Section>
            </>
          )}

          {/* ── CATEGORIES ── */}
          {activeTab === 'categories' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="kd-label">Your Categories ({s.categories.length})</div>
                <button
                  type="button"
                  onClick={() => setShowAddCat(true)}
                  className="kd-btn kd-btn-outline text-[11px] h-7"
                >
                  <Plus size={13} /> Add
                </button>
              </div>
              <div className="space-y-2">
                {s.categories.map(cat => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}
                  >
                    <div className="relative">
                      <button
                        type="button"
                        className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden"
                        style={{ background: `${cat.color}12`, fontSize: '18px', lineHeight: '1' }}
                        onClick={() => setEditingIcon(editingIcon === cat.id ? null : cat.id)}
                      >
                        <span style={{ fontSize: '18px' }}>{cat.icon}</span>
                      </button>
                      {editingIcon === cat.id && (
                        <div
                          className="absolute top-11 left-0 z-10 p-2 rounded-xl grid grid-cols-5 gap-1 animate-scale-in"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
                        >
                          {ICON_OPTIONS.map(icon => (
                            <button
                              key={icon} type="button"
                              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden"
                              style={{ background: cat.icon === icon ? 'var(--primary-soft)' : 'transparent', fontSize: '15px' }}
                              onClick={() => { updateCategory(cat.id, { icon }); setEditingIcon(null) }}
                            >
                              <span style={{ fontSize: '15px' }}>{icon}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      aria-label={`Category: ${cat.name}`}
                      className="flex-1 bg-transparent border-none outline-none text-[13px] font-semibold min-w-0"
                      style={{ color: cat.color }}
                      value={cat.name}
                      onChange={e => updateCategory(cat.id, { name: e.target.value })}
                    />
                    <div className="flex gap-1">
                      {COLOR_OPTIONS.map(c => (
                        <button
                          key={c} type="button"
                          className="w-4 h-4 rounded-full cursor-pointer"
                          style={{
                            background: c,
                            outline: cat.color === c ? '2px solid var(--text)' : 'none',
                            outlineOffset: '2px',
                          }}
                          onClick={() => updateCategory(cat.id, { color: c })}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer opacity-30 hover:opacity-100"
                      style={{ background: 'var(--error-soft)', color: 'var(--error)', transition: 'opacity var(--transition-fast)' }}
                      onClick={() => removeCategory(cat.id)}
                      aria-label={`Delete ${cat.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              {showAddCat && (
                <div className="mt-3 p-4 rounded-xl animate-slide-down" style={{ background: 'var(--elevated)', border: '1px solid var(--primary)44' }}>
                  <div className="text-[11px] font-semibold mb-2" style={{ color: 'var(--text)' }}>New Category</div>
                  <div className="flex flex-wrap gap-1 mb-2.5">
                    {ICON_OPTIONS.map(icon => (
                      <button
                        key={icon} type="button"
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden"
                        style={{ background: newIcon === icon ? 'var(--primary-soft)' : 'transparent', fontSize: '14px' }}
                        onClick={() => setNewIcon(icon)}
                      >
                        <span style={{ fontSize: '14px' }}>{icon}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2.5 items-center mb-2.5">
                    <input
                      aria-label="New category name"
                      className="flex-1 px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none"
                      style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
                      placeholder="Name..."
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCategory()}
                      autoFocus
                    />
                    <div className="flex gap-1">
                      {COLOR_OPTIONS.slice(0, 5).map(c => (
                        <button
                          key={c} type="button"
                          className="w-5 h-5 rounded-full cursor-pointer"
                          style={{ background: c, outline: newColor === c ? '2px solid var(--text)' : 'none', outlineOffset: '2px' }}
                          onClick={() => setNewColor(c)}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={addCategory} className="kd-btn kd-btn-outline flex-1 text-[11px]">Add</button>
                    <button type="button" onClick={() => setShowAddCat(false)} className="kd-btn kd-btn-ghost text-[11px]">Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── TEMPLATES ── */}
          {activeTab === 'templates' && (
            <TemplatesEditor
              settings={s}
              onChange={(templates) => update('templates', templates)}
            />
          )}

          {/* ── POMODORO ── */}
          {activeTab === 'pomodoro' && (
            <>
              <Section title="Cycle Durations">
                <Slider
                  value={s.pomodoro.workMinutes}
                  min={5} max={60} step={5}
                  onChange={v => update('pomodoro', { ...s.pomodoro, workMinutes: v })}
                  label="Work Duration"
                  valueLabel={`${s.pomodoro.workMinutes}m`}
                />
                <Slider
                  value={s.pomodoro.breakMinutes}
                  min={1} max={30} step={1}
                  onChange={v => update('pomodoro', { ...s.pomodoro, breakMinutes: v })}
                  label="Short Break"
                  valueLabel={`${s.pomodoro.breakMinutes}m`}
                />
                <Slider
                  value={s.pomodoro.longBreakMinutes}
                  min={5} max={60} step={5}
                  onChange={v => update('pomodoro', { ...s.pomodoro, longBreakMinutes: v })}
                  label="Long Break"
                  valueLabel={`${s.pomodoro.longBreakMinutes}m`}
                />
                <Slider
                  value={s.pomodoro.cyclesUntilLongBreak}
                  min={2} max={8} step={1}
                  onChange={v => update('pomodoro', { ...s.pomodoro, cyclesUntilLongBreak: v })}
                  label="Cycles Until Long Break"
                  valueLabel={`${s.pomodoro.cyclesUntilLongBreak}`}
                />
              </Section>
            </>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeTab === 'notifications' && (
            <>
              <Section title="Master">
                <Toggle
                  checked={s.notifications.enabled}
                  onChange={v => updateNotif('enabled', v)}
                  label="Enable Notifications"
                  hint="Master switch for all notifications"
                />
              </Section>
              <Section title="Block Events">
                <Toggle
                  checked={s.notifications.blockStart}
                  onChange={v => updateNotif('blockStart', v)}
                  label="Block Started"
                  hint="When a new block begins"
                />
                <Toggle
                  checked={s.notifications.blockEnding}
                  onChange={v => updateNotif('blockEnding', v)}
                  label="Block Ending Soon"
                  hint="5 minutes before a block ends"
                />
                <Toggle
                  checked={s.notifications.overtime}
                  onChange={v => updateNotif('overtime', v)}
                  label="Overtime Alert"
                  hint="When you go past a block's end time"
                />
                <Toggle
                  checked={s.notifications.idle}
                  onChange={v => updateNotif('idle', v)}
                  label="Idle Detection"
                  hint="After 30 min without an active block"
                />
              </Section>
              <Section title="Sound">
                <Toggle
                  checked={s.notifications.sound}
                  onChange={v => updateNotif('sound', v)}
                  label="Notification Sound"
                  hint="Play a sound with notifications"
                />
                {s.notifications.sound && (
                  <div className="py-3">
                    <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text)' }}>Sound Pack</div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['bell', 'chime', 'click'] as SoundPack[]).map(pack => {
                        const active = s.notifications.soundPack === pack
                        return (
                          <button
                            key={pack}
                            type="button"
                            onClick={() => {
                              updateNotif('soundPack', pack)
                              void window.api.playSoundPreview(pack)
                            }}
                            className="flex flex-col items-center gap-1 p-3 rounded-xl cursor-pointer"
                            style={{
                              background: active ? 'var(--primary-soft)' : 'var(--elevated)',
                              border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                              color: active ? 'var(--primary-light)' : 'var(--text-muted)',
                              transition: 'all var(--transition-fast)',
                            }}
                          >
                            <Volume2 size={16} style={{ color: active ? 'var(--primary-light)' : 'var(--text-muted)' }} />
                            <span className="text-[11px] font-bold capitalize">{pack}</span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                      Click a pack to preview
                    </div>
                  </div>
                )}
              </Section>
            </>
          )}

          {/* ── PRODUCTIVITY ── */}
          {activeTab === 'productivity' && (
            <>
              <Section title="Daily Goals">
                <Slider
                  value={s.goalDailyHours}
                  min={1} max={16} step={0.5}
                  onChange={v => update('goalDailyHours', v)}
                  label="Daily Hours Goal"
                  valueLabel={`${s.goalDailyHours}h`}
                />
              </Section>
              <Section title="Startup">
                <Toggle
                  checked={s.autoLaunch}
                  onChange={v => {
                    update('autoLaunch', v)
                    void window.api.setAutoLaunch(v)
                  }}
                  label="Launch Koda at login"
                  hint="Start automatically when you log into your Mac"
                />
              </Section>
              <Section title="Day Review">
                <Toggle
                  checked={s.autoStartReview}
                  onChange={v => update('autoStartReview', v)}
                  label="Auto-open Review"
                  hint="Automatically prompt for review at end of day"
                />
                <Slider
                  value={s.reviewTime}
                  min={17} max={23} step={1}
                  onChange={v => update('reviewTime', v)}
                  label="Review Time"
                  valueLabel={`${String(s.reviewTime).padStart(2, '0')}:00`}
                />
              </Section>
              <Section title="Stats">
                <div className="py-3">
                  <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text)' }}>Week Starts On</div>
                  <div className="flex gap-2">
                    {(['monday', 'sunday'] as const).map(d => (
                      <button
                        key={d} type="button"
                        onClick={() => update('weekStartsOn', d)}
                        className="flex-1 py-2 rounded-lg text-[12px] font-semibold cursor-pointer capitalize"
                        style={{
                          background: s.weekStartsOn === d ? 'var(--primary-soft)' : 'var(--elevated)',
                          color: s.weekStartsOn === d ? 'var(--primary-light)' : 'var(--text-muted)',
                          border: `1px solid ${s.weekStartsOn === d ? 'var(--primary)' : 'var(--border)'}`,
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <Toggle
                  checked={s.showWeekendsInStats}
                  onChange={v => update('showWeekendsInStats', v)}
                  label="Include Weekends"
                  hint="Show Saturday and Sunday in stats"
                />
              </Section>
            </>
          )}

          {/* ── SHORTCUTS ── */}
          {activeTab === 'shortcuts' && (
            <Section title="Keyboard Shortcuts">
              <div className="py-2 space-y-0.5">
                {[
                  { keys: '⌘K', label: 'Quick Add Block' },
                  { keys: '⌘N', label: 'New Block' },
                  { keys: '⌘R', label: 'Review Day' },
                  { keys: '⌘1–4', label: 'Switch Pages' },
                  { keys: '⌘,', label: 'Settings' },
                  { keys: 'T', label: 'Jump to Today' },
                  { keys: '←  →', label: 'Previous / Next Day' },
                  { keys: '?', label: 'Show All Shortcuts' },
                  { keys: 'Esc', label: 'Close Modal' },
                  { keys: '⌘⌥K', label: 'Global Quick Add (system-wide)' },
                ].map(s => (
                  <div key={s.keys} className="flex items-center justify-between py-2">
                    <span className="text-[12px]" style={{ color: 'var(--text)' }}>{s.label}</span>
                    <kbd
                      className="px-2 py-1 rounded text-[11px] font-mono font-semibold"
                      style={{
                        background: 'var(--elevated)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        minWidth: '50px',
                        textAlign: 'center',
                      }}
                    >
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── DATA ── */}
          {activeTab === 'data' && (
            <>
              <Section title="Backup & Restore">
                <div className="py-3">
                  <div className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text)' }}>Export All Data</div>
                  <div className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
                    Save all blocks, settings and templates as a JSON backup file.
                  </div>
                  <button
                    type="button"
                    onClick={() => window.api.exportData()}
                    className="kd-btn kd-btn-outline text-[11px] cursor-pointer"
                  >
                    Export Data…
                  </button>
                </div>
                <div className="py-3">
                  <div className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text)' }}>Import Backup</div>
                  <div className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
                    Restore from a previously exported JSON file. You'll choose merge or overwrite mode.
                  </div>
                  <button
                    type="button"
                    onClick={() => window.api.importData()}
                    className="kd-btn kd-btn-ghost text-[11px] cursor-pointer"
                  >
                    Import Data…
                  </button>
                </div>
              </Section>
              <Section title="Storage">
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>Local Data Folder</div>
                    <div className="text-[10px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-faint)' }}>
                      ~/Library/Application Support/koda/koda-data/
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => window.api.openDataFolder()}
                      className="kd-btn kd-btn-ghost text-[11px]"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => window.api.getDataPath().then(p => navigator.clipboard.writeText(p))}
                      className="kd-btn kd-btn-ghost text-[11px]"
                    >
                      <Copy size={12} /> Copy
                    </button>
                  </div>
                </div>
                <div className="py-3 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--primary-soft)', color: 'var(--primary-light)' }}
                  >
                    <HardDrive size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>Data Size</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {dataStats
                        ? `${formatBytes(dataStats.bytes)} · ${dataStats.daysCount} day${dataStats.daysCount === 1 ? '' : 's'} tracked`
                        : 'Calculating…'}
                    </div>
                  </div>
                </div>
              </Section>
              <Section title="Reset">
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                      Reset Preferences
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      Restore default theme, timeline range, notifications and other settings.
                      Categories, templates, blocks and streak are <strong>kept</strong>.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetSettings}
                    className="kd-btn text-[11px] flex-shrink-0 cursor-pointer"
                    style={{
                      background: confirmReset ? 'var(--error-soft)' : 'var(--elevated)',
                      color: confirmReset ? 'var(--error)' : 'var(--text-secondary)',
                      border: `1px solid ${confirmReset ? 'var(--error)' : 'var(--border)'}`,
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <RotateCcw size={12} /> {confirmReset ? 'Click again to confirm' : 'Reset to Defaults'}
                  </button>
                </div>
              </Section>
              <Section title="Streak">
                <div className="py-3 flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)' }}
                  >
                    <Flame size={20} style={{ color: 'var(--secondary)' }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>Day Streak</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      Current: <span className="font-bold text-gradient">{s.streak}</span> · Best: {s.bestStreak}
                    </div>
                  </div>
                </div>
              </Section>
              <Section title="About">
                <div className="py-3 text-center">
                  <div className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text)' }}>Koda v0.1.0</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-faint)' }}>Personal day planner · Built offline-first</div>
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
