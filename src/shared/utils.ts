/** Convert "HH:MM" to total minutes */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Convert total minutes to "HH:MM" */
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Format minutes as human readable duration.
 * < 60 min → "45m"
 * >= 60 min with remainder → "1h 30m"
 * >= 60 min exact → "2h"
 */
export function formatDuration(mins: number): string {
  if (mins <= 0) return '0m'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Format countdown: always show h/m
 */
export function formatCountdown(mins: number): string {
  if (mins <= 0) return '0m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Get block duration in minutes */
export function blockDuration(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime)
}

/** Get current time as "HH:MM" */
export function nowTimeStr(now: Date): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * Layout overlapping blocks into columns (like Google Calendar).
 * Returns map of blockId → { col, totalCols } so each block knows its lane.
 */
export interface BlockLayout {
  col: number      // column index (0-based)
  totalCols: number // total columns in this overlap group
}

export function layoutOverlappingBlocks<T extends { id: string; startTime: string; endTime: string }>(
  blocks: T[]
): Record<string, BlockLayout> {
  const result: Record<string, BlockLayout> = {}
  if (blocks.length === 0) return result

  // Sort by start, then by duration desc (longer blocks first within same start)
  const sorted = [...blocks].sort((a, b) => {
    const cmp = a.startTime.localeCompare(b.startTime)
    if (cmp !== 0) return cmp
    return timeToMinutes(b.endTime) - timeToMinutes(a.endTime) // longer first
  })

  // Group blocks into clusters where any chain of overlap exists
  const clusters: T[][] = []
  for (const block of sorted) {
    let added = false
    for (const cluster of clusters) {
      const overlaps = cluster.some(b =>
        timeToMinutes(block.startTime) < timeToMinutes(b.endTime) &&
        timeToMinutes(block.endTime) > timeToMinutes(b.startTime)
      )
      if (overlaps) {
        cluster.push(block)
        added = true
        break
      }
    }
    if (!added) clusters.push([block])
  }

  // For each cluster, assign columns greedily
  for (const cluster of clusters) {
    const columns: T[][] = []
    for (const block of cluster) {
      let placed = false
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]
        const last = col[col.length - 1]
        if (timeToMinutes(last.endTime) <= timeToMinutes(block.startTime)) {
          col.push(block)
          result[block.id] = { col: i, totalCols: 0 } // totalCols filled later
          placed = true
          break
        }
      }
      if (!placed) {
        columns.push([block])
        result[block.id] = { col: columns.length - 1, totalCols: 0 }
      }
    }
    // Set totalCols for all blocks in this cluster
    const total = columns.length
    for (const block of cluster) {
      result[block.id].totalCols = total
    }
  }

  return result
}
