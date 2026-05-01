import { useEffect, useRef, useState } from 'react'

/**
 * High-resolution countdown timer driven by requestAnimationFrame.
 * Returns remaining seconds (decimal). Stops automatically when reaching 0.
 */
export function useCountdown(durationSec: number, running: boolean, onComplete?: () => void) {
  const [remaining, setRemaining] = useState(durationSec)
  const startTimeRef = useRef<number | null>(null)
  const initialRemainingRef = useRef<number>(durationSec)
  const completedRef = useRef(false)
  const completeCallbackRef = useRef(onComplete)
  completeCallbackRef.current = onComplete

  // Reset when duration changes from outside
  useEffect(() => {
    setRemaining(durationSec)
    startTimeRef.current = null
    initialRemainingRef.current = durationSec
    completedRef.current = false
  }, [durationSec])

  useEffect(() => {
    if (!running) {
      // Pause: capture current remaining and reset start
      startTimeRef.current = null
      initialRemainingRef.current = remaining
      return
    }

    let raf = 0
    const tick = () => {
      if (startTimeRef.current === null) startTimeRef.current = performance.now()
      const elapsed = (performance.now() - startTimeRef.current) / 1000
      const next = Math.max(0, initialRemainingRef.current - elapsed)
      setRemaining(next)
      if (next === 0) {
        if (!completedRef.current) {
          completedRef.current = true
          completeCallbackRef.current?.()
        }
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, remaining])

  return remaining
}

/**
 * Stopwatch driven by requestAnimationFrame.
 * Returns elapsed seconds (decimal) since `startedAt`.
 * If startedAt is null, returns 0.
 */
export function useStopwatch(startedAt: Date | null) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0)
      return
    }
    const start = startedAt.getTime()
    let raf = 0
    const tick = () => {
      setElapsed((Date.now() - start) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [startedAt])

  return elapsed
}
