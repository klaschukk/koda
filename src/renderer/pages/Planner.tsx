import React from 'react'
import Sidebar from '../components/Sidebar'
import Timeline from '../components/Timeline'
import FocusPanel from '../components/FocusPanel'
import type { AppSettings, DayData, TimeBlock } from '../../shared/types'

interface Props {
  settings: AppSettings
  dayData: DayData
  currentDate: string
  now: Date
  currentBlock: TimeBlock | null
  nextBlock: TimeBlock | null
  onGoToDay: (offset: number) => void
  onGoToToday: () => void
  onAddBlock: (block: Omit<TimeBlock, 'id' | 'completed'>) => void
  onUpdateBlock: (id: string, changes: Partial<TimeBlock>) => void
  onUpdateBlockSilent: (id: string, changes: Partial<TimeBlock>) => void
  onUpdateBlocksBulk: (updates: Array<{ id: string; changes: Partial<TimeBlock> }>) => void
  onDeleteBlock: (id: string) => void
  onDeleteBlocks: (ids: string[]) => void
  onOpenQuickAdd: () => void
  onOpenReview: () => void
  onOpenSettings: () => void
  onLoadIdealDay?: () => void
  onNotify?: (title: string, body: string, color: string) => void
}

export default function Planner({
  settings,
  dayData,
  currentDate,
  now,
  currentBlock,
  nextBlock,
  onGoToDay,
  onGoToToday,
  onAddBlock,
  onUpdateBlock,
  onUpdateBlockSilent,
  onUpdateBlocksBulk,
  onDeleteBlock,
  onDeleteBlocks,
  onOpenQuickAdd,
  onOpenReview,
  onOpenSettings,
  onLoadIdealDay,
  onNotify,
}: Props) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar
        settings={settings}
        dayData={dayData}
        currentDate={currentDate}
        now={now}
        onGoToDay={onGoToDay}
        onGoToToday={onGoToToday}
        onOpenReview={onOpenReview}
        onOpenSettings={onOpenSettings}
        onLoadIdealDay={onLoadIdealDay}
      />
      <Timeline
        dayData={dayData}
        settings={settings}
        now={now}
        currentDate={currentDate}
        onAddBlock={onAddBlock}
        onUpdateBlock={onUpdateBlock}
        onUpdateBlockSilent={onUpdateBlockSilent}
        onUpdateBlocksBulk={onUpdateBlocksBulk}
        onDeleteBlock={onDeleteBlock}
        onDeleteBlocks={onDeleteBlocks}
        onOpenQuickAdd={onOpenQuickAdd}
      />
      <FocusPanel
        currentBlock={currentBlock}
        nextBlock={nextBlock}
        settings={settings}
        now={now}
        currentDate={currentDate}
        onUpdateBlock={onUpdateBlock}
        onNotify={onNotify}
      />
    </div>
  )
}
