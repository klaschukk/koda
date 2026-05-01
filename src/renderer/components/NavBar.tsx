import React from 'react'
import {
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  BarChart3,
  Settings,
  Flame,
} from 'lucide-react'

export type Page = 'dashboard' | 'planner' | 'calendar' | 'stats' | 'settings'

interface NavItem {
  id: Page
  icon: React.ReactNode
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Home' },
  { id: 'planner',   icon: <CalendarClock size={18} />,   label: 'Plan' },
  { id: 'calendar',  icon: <CalendarDays size={18} />,    label: 'Calendar' },
  { id: 'stats',     icon: <BarChart3 size={18} />,       label: 'Stats' },
  { id: 'settings',  icon: <Settings size={18} />,        label: 'Settings' },
]

interface Props {
  activePage: Page
  onNavigate: (page: Page) => void
  streak: number
}

export default function NavBar({ activePage, onNavigate, streak }: Props) {
  return (
    <nav
      className="w-[64px] flex-shrink-0 flex flex-col items-center py-2 border-r no-drag select-none"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="mb-5 mt-0.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black tracking-tight"
          style={{
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            color: 'white',
            boxShadow: '0 2px 12px rgba(99, 102, 241, 0.3)',
          }}
        >
          K
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col items-center gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              type="button"
              className="w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-[3px] relative group cursor-pointer"
              style={{
                background: active ? 'var(--primary-soft)' : 'transparent',
                color: active ? 'var(--primary-light)' : 'var(--text-muted)',
                transition: 'all var(--transition-fast)',
              }}
            >
              {/* Active indicator pill */}
              {active && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
                  style={{ background: 'var(--primary)' }}
                />
              )}

              {/* Hover background */}
              <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100"
                style={{
                  background: active ? 'transparent' : 'var(--elevated)',
                  transition: 'opacity var(--transition-fast)',
                }}
              />

              <span className="relative z-10 transition-colors" style={{ transition: 'color var(--transition-fast)' }}>
                {item.icon}
              </span>
              <span className="relative z-10 text-[7px] font-semibold uppercase tracking-[0.5px] leading-none">
                {item.label}
              </span>

              {/* Tooltip */}
              <div
                className="absolute left-[56px] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50"
                style={{
                  background: 'var(--elevated)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-md)',
                  transition: 'opacity var(--transition-fast)',
                }}
              >
                {item.label}
              </div>
            </button>
          )
        })}
      </div>

      {/* Streak badge */}
      {streak > 0 && (
        <div className="mb-2" aria-label={`${streak} day streak`}>
          <div
            className="w-9 h-9 rounded-xl flex flex-col items-center justify-center gap-px"
            style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(99, 102, 241, 0.05))',
              border: '1px solid rgba(168, 85, 247, 0.2)',
            }}
          >
            <Flame size={12} style={{ color: 'var(--secondary)' }} />
            <span className="text-[9px] font-black text-gradient leading-none">
              {streak}
            </span>
          </div>
        </div>
      )}
    </nav>
  )
}
