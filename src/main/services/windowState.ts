import { app, screen, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'

interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized?: boolean
}

const DEFAULT_STATE: WindowState = {
  width: 1300,
  height: 850,
}

function getStatePath(): string {
  return path.join(app.getPath('userData'), 'koda-data', 'window-state.json')
}

export function readWindowState(): WindowState {
  try {
    const file = getStatePath()
    if (!fs.existsSync(file)) return { ...DEFAULT_STATE }
    const raw = fs.readFileSync(file, 'utf-8')
    const saved = JSON.parse(raw) as Partial<WindowState>
    const state: WindowState = { ...DEFAULT_STATE, ...saved }

    // Validate: window must be on a visible display (user could have unplugged a monitor)
    if (typeof state.x === 'number' && typeof state.y === 'number') {
      const onDisplay = screen.getAllDisplays().some(d => {
        const b = d.workArea
        return state.x! >= b.x && state.y! >= b.y && state.x! < b.x + b.width && state.y! < b.y + b.height
      })
      if (!onDisplay) {
        delete state.x
        delete state.y
      }
    }
    return state
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export function writeWindowState(state: WindowState): void {
  try {
    const file = getStatePath()
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8')
  } catch {
    // Storage might be unavailable on first launch — non-fatal
  }
}

/** Attach listeners that persist size/position whenever the user moves or resizes. */
export function trackWindowState(win: BrowserWindow): void {
  let saveTimer: NodeJS.Timeout | null = null

  const persist = () => {
    if (win.isDestroyed()) return
    const isMaximized = win.isMaximized()
    const bounds = win.getNormalBounds()
    writeWindowState({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized,
    })
  }

  const debounced = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(persist, 400)
  }

  win.on('resize', debounced)
  win.on('move', debounced)
  win.on('maximize', persist)
  win.on('unmaximize', persist)
  win.on('close', persist)
}
