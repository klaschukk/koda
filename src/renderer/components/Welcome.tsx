import { useState } from 'react'
import { ArrowRight, CalendarClock, Flame, Zap, Layout } from 'lucide-react'
import type { AppSettings } from '../../shared/types'

interface Props {
  settings: AppSettings
  onComplete: (settings: AppSettings) => void
}

const STEPS = [
  {
    title: 'Welcome to Koda',
    subtitle: 'Your personal day planner',
    description: 'Plan your day with time blocks, stay focused, and track your progress.',
    icon: <Zap size={40} />,
  },
  {
    title: 'Time Blocks',
    subtitle: 'Drag, drop, resize',
    description: 'Create blocks for each activity. Drag to move, pull edges to resize. Right-click to edit or delete.',
    icon: <CalendarClock size={40} />,
  },
  {
    title: 'Stay Focused',
    subtitle: 'Real-time tracking',
    description: 'See your current block highlighted with a countdown timer. Get notifications when blocks start and end.',
    icon: <Layout size={40} />,
  },
  {
    title: 'Build Streaks',
    subtitle: 'Review your day',
    description: 'Complete a daily review to mark blocks as done. Build a streak by filling your plan every day.',
    icon: <Flame size={40} />,
  },
]

export default function Welcome({ settings, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const handleNext = () => {
    if (isLast) {
      onComplete({ ...settings, lastActiveDate: new Date().toISOString().split('T')[0] })
    } else {
      setStep(step + 1)
    }
  }

  return (
    <div
      className="h-screen flex items-center justify-center"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-[480px] text-center animate-fade-in" key={step}>
        {/* Logo */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black mx-auto mb-8"
          style={{
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            color: 'white',
            boxShadow: '0 4px 24px rgba(99, 102, 241, 0.3)',
          }}
        >
          K
        </div>

        {/* Icon */}
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{
            background: 'var(--primary-soft)',
            color: 'var(--primary-light)',
            border: '1px solid var(--border)',
          }}
        >
          {current.icon}
        </div>

        {/* Content */}
        <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--text)' }}>
          {current.title}
        </h1>
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--primary-light)' }}>
          {current.subtitle}
        </p>
        <p className="text-[13px] leading-relaxed mb-8 max-w-[360px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
          {current.description}
        </p>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? '24px' : '8px',
                background: i === step ? 'var(--primary)' : i < step ? 'var(--primary-light)' : 'var(--border)',
              }}
            />
          ))}
        </div>

        {/* Action */}
        <button
          type="button"
          onClick={handleNext}
          className="kd-btn kd-btn-primary px-8 py-3 text-sm"
        >
          {isLast ? 'Get Started' : 'Next'} <ArrowRight size={15} />
        </button>

        {/* Skip */}
        {!isLast && (
          <button
            type="button"
            onClick={() => onComplete({ ...settings, lastActiveDate: new Date().toISOString().split('T')[0] })}
            className="block mx-auto mt-4 text-[11px] font-medium cursor-pointer"
            style={{ color: 'var(--text-muted)', transition: 'color var(--transition-fast)' }}
          >
            Skip intro
          </button>
        )}
      </div>
    </div>
  )
}
