import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { Pencil, Palette, Trash2, GripVertical, Plus, Copy, X as XIcon, Move } from 'lucide-react'
import type { AppSettings, DayData, TimeBlock } from '../../shared/types'
import { timeToMinutes, minutesToTime, layoutOverlappingBlocks } from '../../shared/utils'

interface Props {
  dayData: DayData
  settings: AppSettings
  now: Date
  currentDate: string
  onAddBlock: (block: Omit<TimeBlock, 'id' | 'completed'>) => void
  onUpdateBlock: (id: string, changes: Partial<TimeBlock>) => void
  onUpdateBlockSilent: (id: string, changes: Partial<TimeBlock>) => void
  onUpdateBlocksBulk: (updates: Array<{ id: string; changes: Partial<TimeBlock> }>) => void
  onDeleteBlock: (id: string) => void
  onDeleteBlocks: (ids: string[]) => void
  onOpenQuickAdd: () => void
}

const MIN_BLOCK_MINUTES = 15
const DEFAULT_HOUR_HEIGHT = 72
const DRAG_THRESHOLD_PX = 4 // pixels of movement before drag is considered started

type DragCreate = {
  startMins: number
  currentMins: number
}

export default function Timeline({
  dayData, settings, now, currentDate,
  onAddBlock, onUpdateBlock, onUpdateBlockSilent, onUpdateBlocksBulk,
  onDeleteBlock, onDeleteBlocks, onOpenQuickAdd,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [editingBlock, setEditingBlock] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; blockId: string } | null>(null)
  const [dragCreate, setDragCreate] = useState<DragCreate | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const isToday = currentDate === new Date().toISOString().split('T')[0]
  const startHour = settings.timelineStart
  const endHour = settings.timelineEnd
  const totalHours = endHour - startHour
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i)

  const HOUR_HEIGHT = settings.hourHeight ?? DEFAULT_HOUR_HEIGHT

  // Reset selection when date changes
  useEffect(() => { setSelectedIds(new Set()) }, [currentDate])

  const nowPosition = useMemo(() => {
    if (!isToday) return null
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const px = ((nowMins - startHour * 60) / 60) * HOUR_HEIGHT
    if (px < 0 || px > totalHours * HOUR_HEIGHT) return null
    return px
  }, [now, isToday, startHour, totalHours, HOUR_HEIGHT])

  // Auto-scroll to current time on mount / date change
  useEffect(() => {
    if (nowPosition !== null && scrollRef.current) {
      const offset = Math.max(0, nowPosition - 200)
      scrollRef.current.scrollTo({ top: offset, behavior: 'smooth' })
    }
  }, [currentDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute parallel layout for overlapping blocks
  const layoutMap = useMemo(() => layoutOverlappingBlocks(dayData.blocks), [dayData.blocks])

  // ── Drag-to-create ──
  const yToMinutes = useCallback((clientY: number): number => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const y = clientY - rect.top + (scrollRef.current?.scrollTop ?? 0)
    return startHour * 60 + (y / HOUR_HEIGHT) * 60
  }, [startHour, HOUR_HEIGHT])

  const snapTo15 = (mins: number) => Math.round(mins / 15) * 15

  const handleBackgroundMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-block]')) return
    e.preventDefault()

    const startMinsRaw = yToMinutes(e.clientY)
    const startMins = snapTo15(Math.max(startHour * 60, Math.min(startMinsRaw, endHour * 60)))
    const startClientY = e.clientY
    let didStartDrag = false

    setSelectedIds(new Set())

    const handleMouseMove = (ev: MouseEvent) => {
      if (!didStartDrag && Math.abs(ev.clientY - startClientY) < DRAG_THRESHOLD_PX) return
      didStartDrag = true
      const curRaw = yToMinutes(ev.clientY)
      const curMins = snapTo15(Math.max(startHour * 60, Math.min(curRaw, endHour * 60)))
      setDragCreate({ startMins, currentMins: curMins })
    }

    const handleMouseUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      if (!didStartDrag) {
        // Treat as click → create 1h block at clicked time, bounded by timeline
        const start = startMins
        const end = Math.min(start + 60, endHour * 60)
        if (end - start < MIN_BLOCK_MINUTES) return
        const defaultCat = settings.defaultCategoryId ?? settings.categories[0]?.id ?? 'other'
        onAddBlock({
          title: 'New block',
          categoryId: defaultCat,
          startTime: minutesToTime(start),
          endTime: minutesToTime(end),
        })
        return
      }

      const curRaw = yToMinutes(ev.clientY)
      const curMins = snapTo15(Math.max(startHour * 60, Math.min(curRaw, endHour * 60)))
      const start = Math.min(startMins, curMins)
      const end = Math.max(startMins, curMins)
      const duration = end - start
      setDragCreate(null)

      if (duration < MIN_BLOCK_MINUTES) return // skip too-short drags
      const defaultCat = settings.defaultCategoryId ?? settings.categories[0]?.id ?? 'other'
      onAddBlock({
        title: 'New block',
        categoryId: defaultCat,
        startTime: minutesToTime(start),
        endTime: minutesToTime(end),
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [yToMinutes, startHour, endHour, settings.categories, settings.defaultCategoryId, onAddBlock])

  // ── Block move / resize handler ──
  const handleBlockMouseDown = useCallback((
    e: React.MouseEvent, blockId: string, type: 'move' | 'resize-top' | 'resize-bottom'
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const block = dayData.blocks.find(b => b.id === blockId)
    if (!block) return

    // Determine which blocks are being dragged together
    const draggingIds = type === 'move' && selectedIds.has(blockId) && selectedIds.size > 1
      ? Array.from(selectedIds)
      : [blockId]
    const draggingBlocks = dayData.blocks.filter(b => draggingIds.includes(b.id))

    // Snapshot original times
    const originals = new Map<string, { start: number; end: number }>()
    draggingBlocks.forEach(b => {
      originals.set(b.id, {
        start: timeToMinutes(b.startTime),
        end: timeToMinutes(b.endTime),
      })
    })

    const startClientY = e.clientY

    const handleMouseMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startClientY
      const dMins = Math.round((dy / HOUR_HEIGHT) * 60 / 15) * 15

      if (type === 'move') {
        // Compute clamp range for the group
        let minDelta = -Infinity
        let maxDelta = Infinity
        draggingBlocks.forEach(b => {
          const orig = originals.get(b.id)!
          minDelta = Math.max(minDelta, startHour * 60 - orig.start)
          maxDelta = Math.min(maxDelta, endHour * 60 - orig.end)
        })
        const clampedDelta = Math.max(minDelta, Math.min(dMins, maxDelta))

        const updates = draggingBlocks.map(b => {
          const orig = originals.get(b.id)!
          return {
            id: b.id,
            changes: {
              startTime: minutesToTime(orig.start + clampedDelta),
              endTime: minutesToTime(orig.end + clampedDelta),
            },
          }
        })
        onUpdateBlocksBulk(updates)
      } else if (type === 'resize-top') {
        const orig = originals.get(blockId)!
        let newStart = orig.start + dMins
        newStart = Math.max(startHour * 60, Math.min(newStart, orig.end - MIN_BLOCK_MINUTES))
        onUpdateBlockSilent(blockId, { startTime: minutesToTime(newStart) })
      } else {
        const orig = originals.get(blockId)!
        let newEnd = orig.end + dMins
        newEnd = Math.max(orig.start + MIN_BLOCK_MINUTES, Math.min(newEnd, endHour * 60))
        onUpdateBlockSilent(blockId, { endTime: minutesToTime(newEnd) })
      }
    }

    const handleMouseUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      // If position actually changed, push a single undo entry by re-applying via onUpdateBlock
      const dy = ev.clientY - startClientY
      const dMins = Math.round((dy / HOUR_HEIGHT) * 60 / 15) * 15
      if (dMins !== 0) {
        if (type === 'move') {
          // For undo, push a synthetic single update on the primary block (others persisted via silent bulk).
          // To keep undo per-block consistent, push individual updates for each.
          draggingBlocks.forEach(b => {
            const orig = originals.get(b.id)!
            const after = type === 'move'
              ? {
                  startTime: minutesToTime(orig.start),
                  endTime: minutesToTime(orig.end),
                }
              : null
            if (after) {
              // We already applied silent bulk; final state is in store.
              // No additional onUpdateBlock call needed here — undo entry is
              // handled at the bulk-update level via onUpdateBlocksBulk.
            }
          })
          // Simpler: capture final state and push single-block updates via onUpdateBlock for undo.
          // Use the latest dayData via ref pattern: we'll dispatch by reading from window state shouldn't be needed —
          // just call onUpdateBlock on the primary block with its final times (no-op visually, but creates undo).
          // For multi-block, push each:
          draggingBlocks.forEach(b => {
            const orig = originals.get(b.id)!
            // Determine final times based on clamped delta — same logic as in move
            let minDelta = -Infinity
            let maxDelta = Infinity
            draggingBlocks.forEach(x => {
              const o = originals.get(x.id)!
              minDelta = Math.max(minDelta, startHour * 60 - o.start)
              maxDelta = Math.min(maxDelta, endHour * 60 - o.end)
            })
            const clampedDelta = Math.max(minDelta, Math.min(dMins, maxDelta))
            const finalStart = minutesToTime(orig.start + clampedDelta)
            const finalEnd = minutesToTime(orig.end + clampedDelta)
            onUpdateBlock(b.id, { startTime: finalStart, endTime: finalEnd })
          })
        } else if (type === 'resize-top') {
          const orig = originals.get(blockId)!
          let newStart = orig.start + dMins
          newStart = Math.max(startHour * 60, Math.min(newStart, orig.end - MIN_BLOCK_MINUTES))
          onUpdateBlock(blockId, { startTime: minutesToTime(newStart) })
        } else if (type === 'resize-bottom') {
          const orig = originals.get(blockId)!
          let newEnd = orig.end + dMins
          newEnd = Math.max(orig.start + MIN_BLOCK_MINUTES, Math.min(newEnd, endHour * 60))
          onUpdateBlock(blockId, { endTime: minutesToTime(newEnd) })
        }
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [dayData.blocks, startHour, endHour, HOUR_HEIGHT, selectedIds, onUpdateBlock, onUpdateBlockSilent, onUpdateBlocksBulk])

  // ── Click selection ──
  const handleBlockClick = useCallback((e: React.MouseEvent, blockId: string) => {
    e.stopPropagation()
    if (e.metaKey || e.ctrlKey) {
      // toggle in selection
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(blockId)) next.delete(blockId)
        else next.add(blockId)
        return next
      })
    } else if (e.shiftKey) {
      // range select between last selected and this block
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.size === 0) {
          next.add(blockId)
          return next
        }
        const sorted = [...dayData.blocks].sort((a, b) => a.startTime.localeCompare(b.startTime))
        const lastIdx = sorted.findIndex(b => prev.has(b.id))
        const thisIdx = sorted.findIndex(b => b.id === blockId)
        if (lastIdx === -1 || thisIdx === -1) {
          next.add(blockId)
          return next
        }
        const [lo, hi] = lastIdx < thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx]
        for (let i = lo; i <= hi; i++) next.add(sorted[i].id)
        return next
      })
    }
    // Plain click without modifiers: do nothing on click (drag handled separately).
  }, [dayData.blocks])

  // ── Context menu ──
  const handleContextMenu = useCallback((e: React.MouseEvent, blockId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, blockId })
  }, [])

  React.useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  // ── Title editing ──
  const handleDoubleClick = useCallback((e: React.MouseEvent, blockId: string) => {
    e.stopPropagation()
    const block = dayData.blocks.find(b => b.id === blockId)
    if (!block) return
    setEditingBlock(blockId)
    setEditTitle(block.title)
  }, [dayData.blocks])

  const saveTitle = useCallback(() => {
    if (editingBlock && editTitle.trim()) {
      onUpdateBlock(editingBlock, { title: editTitle.trim() })
    }
    setEditingBlock(null)
  }, [editingBlock, editTitle, onUpdateBlock])

  const cycleCategory = useCallback((blockId: string) => {
    const block = dayData.blocks.find(b => b.id === blockId)
    if (!block) return
    const idx = settings.categories.findIndex(c => c.id === block.categoryId)
    const next = settings.categories[(idx + 1) % settings.categories.length]
    onUpdateBlock(blockId, { categoryId: next.id })
  }, [dayData.blocks, settings.categories, onUpdateBlock])

  // ── Multi-select bulk actions ──
  const clearSelection = () => setSelectedIds(new Set())

  const bulkDelete = () => {
    onDeleteBlocks(Array.from(selectedIds))
    clearSelection()
  }

  const bulkChangeCategory = (categoryId: string) => {
    selectedIds.forEach(id => {
      const block = dayData.blocks.find(b => b.id === id)
      if (block && block.categoryId !== categoryId) {
        onUpdateBlock(id, { categoryId })
      }
    })
    clearSelection()
  }

  // Drag-create preview computation
  const dragPreview = useMemo(() => {
    if (!dragCreate) return null
    const start = Math.min(dragCreate.startMins, dragCreate.currentMins)
    const end = Math.max(dragCreate.startMins, dragCreate.currentMins)
    if (end - start < MIN_BLOCK_MINUTES) return null
    const top = ((start - startHour * 60) / 60) * HOUR_HEIGHT
    const height = ((end - start) / 60) * HOUR_HEIGHT
    return { top, height, start, end }
  }, [dragCreate, startHour, HOUR_HEIGHT])

  return (
    <div className="flex-1 flex flex-col overflow-hidden no-drag">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-2.5 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>Timeline</span>
        <button
          type="button"
          onClick={onOpenQuickAdd}
          className="kd-btn kd-btn-outline h-7 text-[11px] gap-1"
        >
          <Plus size={13} /> Add Block
        </button>
      </header>

      {/* Timeline body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        <div
          ref={containerRef}
          style={{ height: totalHours * HOUR_HEIGHT + 40, position: 'relative', userSelect: dragCreate ? 'none' : undefined }}
          onMouseDown={handleBackgroundMouseDown}
        >
          {/* Hour lines */}
          {hours.map(hour => {
            const top = (hour - startHour) * HOUR_HEIGHT
            return (
              <div key={hour} className="absolute left-0 right-0 flex items-start pointer-events-none" style={{ top }}>
                <div
                  className="w-[56px] text-right pr-3 text-[10px] font-mono flex-shrink-0 -translate-y-1/2"
                  style={{ color: 'var(--text-faint)' }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>
            )
          })}

          {/* Drag-create preview */}
          {dragPreview && (
            <div
              className="absolute rounded-xl pointer-events-none animate-pulse-soft"
              style={{
                top: dragPreview.top,
                height: dragPreview.height,
                left: '64px',
                width: 'calc(100% - 64px - 12px)',
                background: 'var(--primary-soft)',
                border: '2px dashed var(--primary)',
                opacity: 0.7,
                zIndex: 5,
              }}
            >
              <div className="px-3 py-1 text-[10px] font-mono font-bold" style={{ color: 'var(--primary-light)' }}>
                {minutesToTime(dragPreview.start)} → {minutesToTime(dragPreview.end)}
                <span className="ml-2 opacity-70">
                  ({Math.round((dragPreview.end - dragPreview.start))}m)
                </span>
              </div>
            </div>
          )}

          {/* Blocks */}
          {dayData.blocks.map(block => {
            const cat = settings.categories.find(c => c.id === block.categoryId)
            const color = cat?.color ?? '#64748b'
            const startMins = timeToMinutes(block.startTime) - startHour * 60
            const endMins = timeToMinutes(block.endTime) - startHour * 60
            const top = (startMins / 60) * HOUR_HEIGHT
            const height = Math.max(((endMins - startMins) / 60) * HOUR_HEIGHT, 28)

            const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
            const isCurrent = isToday && block.startTime <= nowTime && block.endTime > nowTime

            const progressPct = isCurrent
              ? ((now.getHours() * 60 + now.getMinutes() - timeToMinutes(block.startTime)) /
                 (timeToMinutes(block.endTime) - timeToMinutes(block.startTime))) * 100
              : 0

            const isSelected = selectedIds.has(block.id)

            // Parallel column layout
            const layout = layoutMap[block.id] ?? { col: 0, totalCols: 1 }
            const GAP = 4 // px between columns
            const colWidth = layout.totalCols > 1
              ? `calc((100% - ${(layout.totalCols - 1) * GAP}px) / ${layout.totalCols})`
              : '100%'
            const colLeft = layout.totalCols > 1
              ? `calc(((100% - ${(layout.totalCols - 1) * GAP}px) / ${layout.totalCols} + ${GAP}px) * ${layout.col})`
              : '0'

            return (
              <div
                key={block.id}
                data-block
                className={`absolute rounded-xl group cursor-grab active:cursor-grabbing ${isCurrent ? 'animate-glow' : ''}`}
                style={{
                  top,
                  height,
                  left: `calc(64px + ${colLeft})`,
                  width: layout.totalCols > 1 ? colWidth : 'calc(100% - 64px - 12px)',
                  background: `${color}0c`,
                  border: `${isSelected ? 2 : 1}px solid ${isSelected ? color : `${color}${isCurrent ? '55' : '28'}`}`,
                  outline: isSelected ? `2px solid ${color}55` : 'none',
                  outlineOffset: '1px',
                  zIndex: isCurrent ? 10 : isSelected ? 8 : 1,
                  transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast), outline var(--transition-fast)',
                  boxShadow: isSelected ? `0 0 0 1px ${color}33, 0 4px 16px ${color}22` : undefined,
                }}
                onMouseDown={e => handleBlockMouseDown(e, block.id, 'move')}
                onClick={e => handleBlockClick(e, block.id)}
                onDoubleClick={e => handleDoubleClick(e, block.id)}
                onContextMenu={e => handleContextMenu(e, block.id)}
              >
                {/* Resize top */}
                <div
                  className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-10"
                  onMouseDown={e => handleBlockMouseDown(e, block.id, 'resize-top')}
                />

                {/* Left color strip */}
                <div
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                  style={{ background: color }}
                />

                {/* Content */}
                <div className="pl-3.5 pr-2 py-1.5 overflow-hidden h-full flex flex-col justify-center">
                  <div className="flex items-center gap-1.5">
                    <GripVertical
                      size={12}
                      className="opacity-0 group-hover:opacity-40 flex-shrink-0"
                      style={{ color, transition: 'opacity var(--transition-fast)' }}
                      aria-hidden="true"
                    />
                    {editingBlock === block.id ? (
                      <input
                        aria-label="Block title"
                        className="bg-transparent border-none outline-none text-xs font-semibold flex-1 min-w-0"
                        style={{ color }}
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingBlock(null); }}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-xs font-semibold truncate" style={{ color }}>{block.title}</span>
                    )}
                  </div>
                  {height >= 44 && (
                    <div className="text-[9px] mt-0.5 font-mono pl-[18px]" style={{ color: `${color}77` }}>
                      {block.startTime} → {block.endTime}
                      {block.actualStart && block.actualEnd && (() => {
                        const actMs = new Date(block.actualEnd).getTime() - new Date(block.actualStart).getTime()
                        const actMins = Math.round(actMs / 60000)
                        return <span className="ml-1.5" style={{ color }}>· tracked {actMins}m</span>
                      })()}
                    </div>
                  )}
                  {isCurrent && height >= 52 && (
                    <div className="mt-1.5 pl-[18px]">
                      <div className="h-[3px] rounded-full overflow-hidden" style={{ background: `${color}18` }}>
                        <div
                          className="h-full rounded-full animate-pulse-soft"
                          style={{ width: `${progressPct}%`, background: color, transition: 'width 1s ease-out' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Resize bottom */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-10"
                  onMouseDown={e => handleBlockMouseDown(e, block.id, 'resize-bottom')}
                />
              </div>
            )
          })}

          {/* NOW line */}
          {nowPosition !== null && (
            <div
              className="absolute left-[48px] right-0 flex items-center z-20 pointer-events-none"
              style={{ top: nowPosition }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: 'var(--now-line)', boxShadow: '0 0 6px var(--now-line)' }}
              />
              <div className="flex-1 h-[1.5px]" style={{ background: 'var(--now-line)', opacity: 0.5 }} />
            </div>
          )}

          {/* Empty state */}
          {dayData.blocks.length === 0 && !dragCreate && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center animate-fade-in">
                <Plus size={32} className="mx-auto mb-2" style={{ color: 'var(--text-faint)' }} />
                <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                  Click or drag to create a block
                </div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>
                  or press <kbd className="font-mono text-[10px] px-1 py-px rounded" style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}>⌘⇧Space</kbd>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multi-select floating action bar */}
      {selectedIds.size > 1 && (
        <MultiSelectBar
          count={selectedIds.size}
          categories={settings.categories}
          onClear={clearSelection}
          onDelete={bulkDelete}
          onChangeCategory={bulkChangeCategory}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-xl py-1.5 animate-scale-in min-w-[160px]"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 cursor-pointer"
            style={{ color: 'var(--text)', transition: 'background var(--transition-fast)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--elevated)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              const block = dayData.blocks.find(b => b.id === contextMenu.blockId)
              if (block) { setEditingBlock(block.id); setEditTitle(block.title) }
              setContextMenu(null)
            }}
          >
            <Pencil size={13} /> Edit Title
          </button>
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 cursor-pointer"
            style={{ color: 'var(--text)', transition: 'background var(--transition-fast)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--elevated)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { cycleCategory(contextMenu.blockId); setContextMenu(null) }}
          >
            <Palette size={13} /> Change Category
          </button>
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 cursor-pointer"
            style={{ color: 'var(--text)', transition: 'background var(--transition-fast)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--elevated)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              const block = dayData.blocks.find(b => b.id === contextMenu.blockId)
              if (block) {
                const dur = timeToMinutes(block.endTime) - timeToMinutes(block.startTime)
                const newStart = timeToMinutes(block.endTime)
                const newEnd = Math.min(newStart + dur, endHour * 60)
                if (newEnd - newStart >= MIN_BLOCK_MINUTES) {
                  onAddBlock({
                    title: block.title,
                    categoryId: block.categoryId,
                    startTime: minutesToTime(newStart),
                    endTime: minutesToTime(newEnd),
                  })
                }
              }
              setContextMenu(null)
            }}
          >
            <Copy size={13} /> Duplicate
          </button>
          <div className="h-px mx-2 my-1" style={{ background: 'var(--border)' }} />
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 cursor-pointer"
            style={{ color: 'var(--error)', transition: 'background var(--transition-fast)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--error-soft)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { onDeleteBlock(contextMenu.blockId); setContextMenu(null) }}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ── Multi-select bar ──
function MultiSelectBar({
  count, categories, onClear, onDelete, onChangeCategory,
}: {
  count: number
  categories: { id: string; name: string; color: string }[]
  onClear: () => void
  onDelete: () => void
  onChangeCategory: (id: string) => void
}) {
  const [showCats, setShowCats] = useState(false)
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-6 z-40 flex items-center gap-1 px-2 py-2 rounded-2xl animate-slide-up no-drag"
      style={{
        background: 'rgba(12, 12, 36, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div className="px-3 py-1 flex items-center gap-2">
        <Move size={13} style={{ color: 'var(--primary-light)' }} />
        <span className="text-[12px] font-bold" style={{ color: 'var(--text)' }}>{count} selected</span>
      </div>
      <div className="w-px h-5" style={{ background: 'var(--border)' }} />
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowCats(v => !v)}
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
          style={{ color: 'var(--text-secondary)', background: 'transparent', transition: 'background var(--transition-fast)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Palette size={12} /> Category
        </button>
        {showCats && (
          <div
            className="absolute bottom-full mb-2 left-0 rounded-xl p-1.5 animate-scale-in min-w-[140px]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
          >
            {categories.map(c => (
              <button
                key={c.id} type="button"
                onClick={() => { onChangeCategory(c.id); setShowCats(false) }}
                className="w-full px-2.5 py-1.5 text-left text-[11px] font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
                style={{ color: c.color, background: 'transparent', transition: 'background var(--transition-fast)' }}
                onMouseEnter={e => (e.currentTarget.style.background = `${c.color}15`)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
        style={{ color: 'var(--error)', background: 'transparent', transition: 'background var(--transition-fast)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--error-soft)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <Trash2 size={12} /> Delete
      </button>
      <div className="w-px h-5" style={{ background: 'var(--border)' }} />
      <button
        type="button"
        onClick={onClear}
        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
        style={{ color: 'var(--text-muted)', transition: 'color var(--transition-fast)' }}
        aria-label="Clear selection"
      >
        <XIcon size={13} />
      </button>
    </div>
  )
}
