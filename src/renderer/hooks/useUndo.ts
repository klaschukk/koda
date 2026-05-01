import { useCallback, useRef, useState } from 'react'
import type { TimeBlock } from '../../shared/types'

const MAX_STACK = 50

export type UndoAction =
  | { type: 'add'; date: string; block: TimeBlock }
  | { type: 'delete'; date: string; block: TimeBlock }
  | { type: 'update'; date: string; before: TimeBlock; after: TimeBlock }
  | { type: 'addMany'; date: string; blocks: TimeBlock[] }
  | { type: 'deleteMany'; date: string; blocks: TimeBlock[] }

export interface UndoToast {
  message: string
  redoAction: UndoAction
}

export interface UndoApi {
  push: (action: UndoAction) => void
  undo: () => UndoAction | null
  redo: () => UndoAction | null
  canUndo: boolean
  canRedo: boolean
  clear: () => void
  describe: (action: UndoAction) => string
}

export function describeUndo(action: UndoAction): string {
  switch (action.type) {
    case 'add': return `added "${action.block.title}"`
    case 'delete': return `deleted "${action.block.title}"`
    case 'update': return `edited "${action.after.title}"`
    case 'addMany': return `added ${action.blocks.length} blocks`
    case 'deleteMany': return `deleted ${action.blocks.length} blocks`
  }
}

export function useUndo(): UndoApi {
  const undoStack = useRef<UndoAction[]>([])
  const redoStack = useRef<UndoAction[]>([])
  // tick to force rerender on push/pop so canUndo/canRedo update
  const [, setTick] = useState(0)
  const bump = () => setTick(t => t + 1)

  const push = useCallback((action: UndoAction) => {
    undoStack.current.push(action)
    if (undoStack.current.length > MAX_STACK) undoStack.current.shift()
    redoStack.current = [] // any new action invalidates redo
    bump()
  }, [])

  const undo = useCallback((): UndoAction | null => {
    const action = undoStack.current.pop()
    if (!action) return null
    redoStack.current.push(action)
    bump()
    return action
  }, [])

  const redo = useCallback((): UndoAction | null => {
    const action = redoStack.current.pop()
    if (!action) return null
    undoStack.current.push(action)
    bump()
    return action
  }, [])

  const clear = useCallback(() => {
    undoStack.current = []
    redoStack.current = []
    bump()
  }, [])

  return {
    push,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    clear,
    describe: describeUndo,
  }
}
