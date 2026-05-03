import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, Coffee, Brain, SkipForward } from 'lucide-react'
import type { AppSettings, TimeBlock } from '../../shared/types'
import { useCountdown } from '../hooks/useTimer'

interface Props {
  enabled: boolean
  currentBlock: TimeBlock | null
  settings: AppSettings
  onNotify?: (title: string, body: string, color: string) => void
}

type Phase = 'work' | 'break' | 'long-break'

interface PomodoroState {
  phase: Phase
  cycle: number       // number of completed work cycles in this session
  running: boolean
  durationSec: number
}

function formatTime(sec: number): string {
  const total = Math.max(0, Math.ceil(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function PomodoroPanel({ enabled, currentBlock, settings, onNotify }: Props) {
  const cfg = settings.pomodoro
  const [state, setState] = useState<PomodoroState>(() => ({
    phase: 'work',
    cycle: 0,
    running: false,
    durationSec: cfg.workMinutes * 60,
  }))
  const stateRef = useRef(state)
  stateRef.current = state

  // Reset when pomodoro is disabled
  useEffect(() => {
    if (!enabled) {
      setState({ phase: 'work', cycle: 0, running: false, durationSec: cfg.workMinutes * 60 })
    }
  }, [enabled, cfg.workMinutes])

  // Reset when current block changes (different focus session)
  useEffect(() => {
    setState(prev => ({ ...prev, phase: 'work', cycle: 0, running: false, durationSec: cfg.workMinutes * 60 }))
  }, [currentBlock?.id, cfg.workMinutes])

  const handleComplete = () => {
    const s = stateRef.current
    if (s.phase === 'work') {
      const nextCycle = s.cycle + 1
      const isLongBreak = nextCycle % cfg.cyclesUntilLongBreak === 0
      const nextPhase: Phase = isLongBreak ? 'long-break' : 'break'
      const dur = (isLongBreak ? cfg.longBreakMinutes : cfg.breakMinutes) * 60
      onNotify?.(
        'Work cycle complete',
        isLongBreak ? `Long break — ${cfg.longBreakMinutes}m` : `Break time — ${cfg.breakMinutes}m`,
        '#22c55e',
      )
      setState({ phase: nextPhase, cycle: nextCycle, running: true, durationSec: dur })
    } else {
      onNotify?.('Break over', `Back to work — ${cfg.workMinutes}m`, '#6366f1')
      setState({ phase: 'work', cycle: s.cycle, running: true, durationSec: cfg.workMinutes * 60 })
    }
  }

  const remaining = useCountdown(state.durationSec, state.running && enabled, handleComplete)

  const phaseInfo = useMemo(() => {
    if (state.phase === 'work') {
      return { color: 'var(--primary)', label: 'Focus', icon: <Brain size={14} /> }
    }
    if (state.phase === 'long-break') {
      return { color: 'var(--success)', label: 'Long Break', icon: <Coffee size={14} /> }
    }
    return { color: 'var(--success)', label: 'Break', icon: <Coffee size={14} /> }
  }, [state.phase])

  const totalDur = state.durationSec
  const progress = totalDur > 0 ? Math.max(0, Math.min(1, 1 - remaining / totalDur)) : 0

  const toggleRunning = () => setState(s => ({ ...s, running: !s.running }))
  const resetTimer = () => {
    setState({ phase: 'work', cycle: 0, running: false, durationSec: cfg.workMinutes * 60 })
  }
  const skipPhase = () => handleComplete()

  if (!enabled) return null

  return (
    <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="kd-label flex items-center gap-1.5">
          <span style={{ color: phaseInfo.color }}>{phaseInfo.icon}</span>
          Pomodoro · {phaseInfo.label}
        </div>
        <span className="text-[9px] font-mono" style={{ color: 'var(--text-faint)' }}>
          {state.cycle} / {cfg.cyclesUntilLongBreak}
        </span>
      </div>

      <div
        className="rounded-2xl p-4 text-center"
        style={{
          background: `${phaseInfo.color}06`,
          border: `1px solid ${phaseInfo.color}22`,
        }}
      >
        <div
          className="font-mono tabular-nums font-black tracking-tight"
          style={{
            fontSize: '54px',
            lineHeight: 1,
            color: phaseInfo.color,
            textShadow: `0 0 24px ${phaseInfo.color}33`,
          }}
        >
          {formatTime(remaining)}
        </div>

        {/* Progress bar */}
        <div
          className="h-1 rounded-full mt-3 overflow-hidden"
          style={{ background: `${phaseInfo.color}15` }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress * 100}%`,
              background: phaseInfo.color,
              transition: 'width 200ms linear',
            }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          <button
            type="button"
            onClick={toggleRunning}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
            style={{
              background: state.running ? `${phaseInfo.color}18` : phaseInfo.color,
              color: state.running ? phaseInfo.color : 'white',
              border: `1px solid ${phaseInfo.color}55`,
              transition: 'all var(--transition-fast)',
            }}
            aria-label={state.running ? 'Pause pomodoro' : 'Start pomodoro'}
          >
            {state.running ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Start</>}
          </button>
          <button
            type="button"
            onClick={skipPhase}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{
              background: 'var(--elevated)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              transition: 'all var(--transition-fast)',
            }}
            aria-label="Skip phase"
            title="Skip current phase"
          >
            <SkipForward size={12} />
          </button>
          <button
            type="button"
            onClick={resetTimer}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{
              background: 'var(--elevated)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              transition: 'all var(--transition-fast)',
            }}
            aria-label="Reset pomodoro"
            title="Reset timer"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* Cycle dots */}
      <div className="flex justify-center gap-1 mt-2.5">
        {Array.from({ length: cfg.cyclesUntilLongBreak }, (_, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: i < (state.cycle % cfg.cyclesUntilLongBreak)
                ? phaseInfo.color
                : 'var(--border)',
              transition: 'background var(--transition-fast)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
