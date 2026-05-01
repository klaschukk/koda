import { app, BrowserWindow, Tray, Menu, nativeImage, screen } from 'electron'
import path from 'path'
import { readSettings } from './services/storage'
import type { TrayState } from '../shared/types'

const POPUP_WIDTH = 360
const POPUP_HEIGHT = 500

// ── Resolve assets path (dev vs packaged app) ──
function assetsPath(...parts: string[]): string {
  // In production, electron-builder places assets in resources/assets
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', ...parts)
  }
  // In dev, dist/main is two levels under project root
  return path.join(__dirname, '..', '..', 'assets', ...parts)
}

// ── Module state ──
let tray: Tray | null = null
let popup: BrowserWindow | null = null
let lastState: TrayState | null = null

interface TrayCallbacks {
  onOpenMain: () => void
  onOpenQuickAdd: () => void
  onOpenReview: () => void
  onQuit: () => void
  onOpenSettings: () => void
  getCurrentTheme: () => 'dark' | 'light'
}

let callbacks: TrayCallbacks | null = null

// ── Tray icon ──
function buildTrayImage() {
  const iconPath = assetsPath('tray', 'iconTemplate.png')
  const img = nativeImage.createFromPath(iconPath)
  // Mark as template so macOS auto-inverts (white on dark menubar, black on light)
  img.setTemplateImage(true)
  return img
}

// ── Popup window ──
function buildPopup(): BrowserWindow {
  const win = new BrowserWindow({
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const isDev = process.env.NODE_ENV === 'development'
  if (isDev) {
    win.loadURL('http://localhost:5174/tray.html')
  } else {
    win.loadFile(path.join(__dirname, '..', 'renderer', 'tray.html'))
  }

  // Auto-hide on blur (click-outside)
  win.on('blur', () => {
    if (!win.isDestroyed()) win.hide()
  })

  // Push the latest state once the popup finishes loading
  win.webContents.on('did-finish-load', () => {
    if (lastState && !win.isDestroyed()) {
      win.webContents.send('koda:trayState', lastState)
    }
  })

  return win
}

function positionPopup(win: BrowserWindow, trayBounds: Electron.Rectangle) {
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
  const workArea = display.workArea
  const winBounds = win.getBounds()

  // Position centered under the tray icon
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2)
  let y = Math.round(trayBounds.y + trayBounds.height + 4)

  // Clamp to screen work area horizontally
  const margin = 6
  x = Math.max(workArea.x + margin, Math.min(x, workArea.x + workArea.width - winBounds.width - margin))
  // If the icon is on the bottom (rare on macOS) — flip above
  if (y + winBounds.height > workArea.y + workArea.height - margin) {
    y = Math.round(trayBounds.y - winBounds.height - 4)
  }

  win.setBounds({ x, y, width: winBounds.width, height: winBounds.height })
}

function togglePopup() {
  if (!tray) return
  if (!popup || popup.isDestroyed()) popup = buildPopup()

  if (popup.isVisible()) {
    popup.hide()
    return
  }

  positionPopup(popup, tray.getBounds())
  popup.show()
  popup.focus()
}

function buildContextMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Open Koda',
      accelerator: 'CommandOrControl+Shift+K',
      click: () => callbacks?.onOpenMain(),
    },
    {
      label: 'Quick Add…',
      accelerator: 'CommandOrControl+Alt+K',
      click: () => callbacks?.onOpenQuickAdd(),
    },
    {
      label: 'Review Day',
      click: () => callbacks?.onOpenReview(),
    },
    { type: 'separator' },
    {
      label: 'Settings…',
      click: () => callbacks?.onOpenSettings(),
    },
    { type: 'separator' },
    {
      label: 'Quit Koda',
      accelerator: 'CommandOrControl+Q',
      click: () => callbacks?.onQuit(),
    },
  ])
}

// ── Public API ──

export function setupTray(cb: TrayCallbacks): Tray {
  callbacks = cb

  if (tray) return tray

  tray = new Tray(buildTrayImage())
  tray.setToolTip('Koda')

  // Left click → toggle popup
  tray.on('click', () => togglePopup())

  // Right click → context menu (use popUpContextMenu so left-click stays for popup)
  tray.on('right-click', () => {
    tray?.popUpContextMenu(buildContextMenu())
  })

  return tray
}

/**
 * Update the live label next to the tray icon.
 * Pass empty string to clear (icon only).
 */
export function setTrayLabel(label: string): void {
  if (!tray) return
  tray.setTitle(label ?? '')
}

/**
 * Push the latest state to the popup window. Caches it so a freshly-opened
 * popup gets it immediately on did-finish-load.
 */
export function pushTrayState(state: TrayState): void {
  lastState = state
  if (popup && !popup.isDestroyed() && popup.webContents) {
    popup.webContents.send('koda:trayState', state)
  }
}

export function getLastTrayState(): TrayState | null {
  return lastState
}

export function hidePopup(): void {
  if (popup && !popup.isDestroyed() && popup.isVisible()) {
    popup.hide()
  }
}

/**
 * Build initial fallback state used before the renderer pushes one.
 * Reads settings to pick up theme / streak so the popup looks correct immediately.
 */
export function buildFallbackState(): TrayState {
  const settings = readSettings()
  return {
    date: new Date().toISOString().split('T')[0],
    current: null,
    upcoming: [],
    totals: {
      plannedMins: 0,
      completedMins: 0,
      completionPct: 0,
      blocksTotal: 0,
      blocksDone: 0,
      blocksRemaining: 0,
    },
    streak: settings.streak,
    theme: settings.theme,
  }
}

export function destroyTray(): void {
  if (popup && !popup.isDestroyed()) {
    popup.destroy()
    popup = null
  }
  if (tray && !tray.isDestroyed()) {
    tray.destroy()
    tray = null
  }
}
