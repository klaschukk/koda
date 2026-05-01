import { app, BrowserWindow, globalShortcut, nativeTheme, ipcMain } from 'electron'
import path from 'path'
import { registerHandlers } from './ipc/handlers'
import { readSettings } from './services/storage'
import { setupAppMenu, showAboutDialog } from './menu'
import { readWindowState, trackWindowState } from './services/windowState'
import {
  setupTray,
  pushTrayState as trayPush,
  setTrayLabel,
  hidePopup as trayHidePopup,
  buildFallbackState,
  destroyTray,
} from './tray'
import { showRichNotification, focusMainWindowOnBlock, playSoundPreview } from './notifications'
import type {
  TrayState,
  NotificationRequest,
  NotificationActionEvent,
  AppSettings,
} from '../shared/types'

const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
}

function createWindow(): void {
  // Read saved theme to set initial background color
  const settings = readSettings()
  const isDark = settings.theme !== 'light'

  // Restore previous window size + position
  const winState = readWindowState()

  mainWindow = new BrowserWindow({
    width: winState.width,
    height: winState.height,
    x: winState.x,
    y: winState.y,
    minWidth: 1000,
    minHeight: 650,
    title: 'Koda',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: isDark ? '#08081a' : '#f4f4f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (winState.isMaximized) mainWindow.maximize()

  // Persist size/position on resize/move/close
  trackWindowState(mainWindow)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * Apply OS-level login-item state. Called on startup and whenever the
 * autoLaunch setting changes.
 */
function applyLoginItem(enabled: boolean): void {
  if (process.platform !== 'darwin') return
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: false,
    name: 'Koda',
  })
}

app.whenReady().then(() => {
  registerHandlers(ipcMain)

  // ── Theme sync ──
  ipcMain.handle('koda:setTheme', (_e, theme: 'dark' | 'light') => {
    if (mainWindow) {
      mainWindow.setBackgroundColor(theme === 'light' ? '#f4f4f8' : '#08081a')
    }
    nativeTheme.themeSource = theme
  })

  // ── Notifications ──
  ipcMain.handle('koda:showNotification', (_e, req: NotificationRequest) => {
    showRichNotification(req, {
      onClick: (blockId) => focusMainWindowOnBlock(mainWindow, blockId),
      onAction: (action, blockId) => {
        if (!blockId) return
        const event: NotificationActionEvent = { blockId, action }
        focusMainWindowOnBlock(mainWindow, blockId)
        mainWindow?.webContents.send('koda:notificationAction', event)
      },
    })
  })

  // ── Auto-launch ──
  ipcMain.handle('koda:getAutoLaunch', () => {
    if (process.platform !== 'darwin') return false
    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle('koda:setAutoLaunch', (_e, enabled: boolean) => {
    applyLoginItem(enabled)
  })

  // ── Tray ──
  ipcMain.handle('koda:pushTrayState', (_e, state: TrayState) => {
    trayPush(state)

    // Live label next to tray icon
    if (state.current) {
      const label = ` ${state.current.categoryIcon} ${state.current.categoryName} · ${formatRemain(state.current.remainingMins)}`
      setTrayLabel(label)
    } else {
      setTrayLabel('')
    }

    // Dock badge: remaining blocks for today
    const remaining = state.totals.blocksRemaining
    if (process.platform === 'darwin' && app.dock) {
      app.dock.setBadge(remaining > 0 ? String(remaining) : '')
    }
  })

  ipcMain.handle('koda:trayRequestState', () => {
    // Renderer popup just opened — ask main window to recompute & push.
    // If main window isn't ready yet, push a fallback so the popup isn't blank.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('koda:trayRequestState')
    } else {
      trayPush(buildFallbackState())
    }
  })

  ipcMain.handle('koda:trayOpenMain', () => {
    trayHidePopup()
    focusMainWindow()
  })

  ipcMain.handle('koda:trayOpenQuickAdd', () => {
    trayHidePopup()
    focusMainWindow()
    mainWindow?.webContents.send('koda:quickAdd')
  })

  ipcMain.handle('koda:trayOpenReview', () => {
    trayHidePopup()
    focusMainWindow()
    mainWindow?.webContents.send('koda:openReview')
  })

  ipcMain.handle('koda:trayClosePopup', () => {
    trayHidePopup()
  })

  ipcMain.handle('koda:setTrayLabel', (_e, label: string) => {
    setTrayLabel(label)
  })

  ipcMain.handle('koda:setDockBadge', (_e, text: string) => {
    if (process.platform === 'darwin' && app.dock) {
      app.dock.setBadge(text ?? '')
    }
  })

  // ── Sound preview from Settings ──
  ipcMain.handle('koda:playSoundPreview', (_e, pack: 'bell' | 'chime' | 'click' | 'none') => {
    playSoundPreview(pack)
  })

  // ── Initial settings → apply auto-launch on every boot ──
  const settingsAtBoot: AppSettings = readSettings()
  applyLoginItem(settingsAtBoot.autoLaunch)

  createWindow()

  // Setup native macOS application menu (File / Edit / View / Window / Help)
  setupAppMenu(mainWindow)

  // Setup menubar tray + popup window
  setupTray({
    onOpenMain: () => focusMainWindow(),
    onOpenQuickAdd: () => {
      focusMainWindow()
      mainWindow?.webContents.send('koda:quickAdd')
    },
    onOpenReview: () => {
      focusMainWindow()
      mainWindow?.webContents.send('koda:openReview')
    },
    onOpenSettings: () => {
      focusMainWindow()
      mainWindow?.webContents.send('koda:menu:navigate', 'settings')
    },
    onQuit: () => {
      app.quit()
    },
    getCurrentTheme: () => readSettings().theme,
  })

  // About dialog handler from menu
  ipcMain.on('koda:menu:about', () => {
    if (mainWindow) void showAboutDialog(mainWindow)
  })

  // Global shortcut: Cmd+Option+K — focus app + open quick add (doesn't conflict with system)
  globalShortcut.register('CommandOrControl+Alt+K', () => {
    focusMainWindow()
    mainWindow?.webContents.send('koda:quickAdd')
  })

  // Global shortcut: Cmd+Shift+K — focus app
  globalShortcut.register('CommandOrControl+Shift+K', () => {
    focusMainWindow()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  destroyTray()
})

app.on('window-all-closed', () => {
  // On macOS we keep running for the tray. Other platforms quit.
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Tray label helper
function formatRemain(mins: number): string {
  if (mins <= 0) return '0m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${m}m`
}
