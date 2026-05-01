import { app, Notification, BrowserWindow } from 'electron'
import path from 'path'
import { exec } from 'child_process'
import type { NotificationRequest, NotificationActionType, SoundPack } from '../shared/types'

const NOTIF_GROUP_ID = 'com.klaschuk.koda'

function assetsPath(...parts: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', ...parts)
  }
  return path.join(__dirname, '..', '..', 'assets', ...parts)
}

function soundFile(pack: SoundPack): string | null {
  if (pack === 'none') return null
  return assetsPath('sounds', `${pack}.mp3`)
}

/** Play a sound pack preview (used from Settings UI). */
export function playSoundPreview(pack: SoundPack): void {
  const file = soundFile(pack)
  if (file) playSound(file)
}

/** Play sound out of band via macOS afplay (does not block). */
function playSound(file: string): void {
  if (process.platform !== 'darwin') return
  exec(`/usr/bin/afplay ${JSON.stringify(file)}`, () => {
    /* swallow errors — sound is best-effort */
  })
}

interface ShowOptions {
  /** Called when the user clicks the body of the notification. */
  onClick?: (blockId?: string) => void
  /** Called when the user clicks an action button. */
  onAction?: (action: NotificationActionType, blockId?: string) => void
}

/**
 * Show an OS notification with optional action buttons and custom sound.
 * On macOS Big Sur+, action buttons appear when the user expands the
 * notification (or via long-press in Notification Center).
 */
export function showRichNotification(req: NotificationRequest, opts: ShowOptions = {}): void {
  if (!Notification.isSupported()) return

  const actions = req.withActions
    ? [
        { type: 'button' as const, text: 'Mark Done' },
        { type: 'button' as const, text: 'Snooze 5m' },
        { type: 'button' as const, text: 'Skip' },
      ]
    : []

  const notif = new Notification({
    title: req.title,
    body: req.body,
    subtitle: req.subtitle,
    silent: true,                 // we play our own sound
    actions,
    closeButtonText: 'Close',
    timeoutType: 'default',
    // macOS thread / grouping identifier
    // (Electron forwards this to UNUserNotificationCenter)
    // @ts-expect-error — `threadIdentifier` is supported on macOS but missing from older Electron typings
    threadIdentifier: NOTIF_GROUP_ID,
  })

  notif.on('click', () => {
    opts.onClick?.(req.blockId)
  })

  notif.on('action', (_e, index) => {
    const map: NotificationActionType[] = ['done', 'snooze', 'skip']
    const action = map[index]
    if (action) opts.onAction?.(action, req.blockId)
  })

  notif.show()

  // Custom sound. We mark the notification silent above so OS doesn't double-play.
  if (!req.silent && req.soundPack) {
    const file = soundFile(req.soundPack)
    if (file) playSound(file)
  }
}

/**
 * Activate the main window and reveal a specific block id (best-effort).
 * Used as the click-handler entry point.
 */
export function focusMainWindowOnBlock(mainWindow: BrowserWindow | null, blockId?: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
  if (blockId) {
    mainWindow.webContents.send('koda:focusBlock', blockId)
  }
}
