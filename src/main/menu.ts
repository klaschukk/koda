import { app, Menu, BrowserWindow, shell, dialog } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'

export function buildAppMenu(mainWindow: BrowserWindow | null): Menu {
  const isMac = process.platform === 'darwin'

  const send = (channel: string, ...args: unknown[]) => {
    mainWindow?.webContents.send(channel, ...args)
  }

  const template: MenuItemConstructorOptions[] = [
    // ── App menu (macOS only) ──
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: 'About Koda', click: () => send('koda:menu:about') },
        { type: 'separator' as const },
        { label: 'Settings…', accelerator: 'Cmd+,', click: () => send('koda:menu:navigate', 'settings') },
        { label: 'Keyboard Shortcuts…', accelerator: 'Shift+?', click: () => send('koda:menu:shortcuts') },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),

    // ── File ──
    {
      label: 'File',
      submenu: [
        {
          label: 'New Block…',
          accelerator: 'Cmd+N',
          click: () => send('koda:menu:quickAdd'),
        },
        {
          label: 'Quick Add',
          accelerator: 'Cmd+K',
          click: () => send('koda:menu:quickAdd'),
        },
        { type: 'separator' },
        {
          label: 'Review Day',
          accelerator: 'Cmd+R',
          click: () => send('koda:menu:review'),
        },
        { type: 'separator' },
        {
          label: 'Export Data…',
          click: () => send('koda:menu:exportData'),
        },
        {
          label: 'Import Data…',
          click: () => send('koda:menu:importData'),
        },
        ...(isMac ? [] : [{ type: 'separator' as const }, { role: 'quit' as const }]),
      ],
    },

    // ── Edit ──
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },

    // ── View ──
    {
      label: 'View',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'Cmd+1',
          click: () => send('koda:menu:navigate', 'dashboard'),
        },
        {
          label: 'Planner',
          accelerator: 'Cmd+2',
          click: () => send('koda:menu:navigate', 'planner'),
        },
        {
          label: 'Calendar',
          accelerator: 'Cmd+3',
          click: () => send('koda:menu:navigate', 'calendar'),
        },
        {
          label: 'Stats',
          accelerator: 'Cmd+4',
          click: () => send('koda:menu:navigate', 'stats'),
        },
        { type: 'separator' },
        {
          label: 'Today',
          accelerator: 'Cmd+T',
          click: () => send('koda:menu:goToToday'),
        },
        {
          label: 'Previous Day',
          accelerator: 'Cmd+Left',
          click: () => send('koda:menu:goToDay', -1),
        },
        {
          label: 'Next Day',
          accelerator: 'Cmd+Right',
          click: () => send('koda:menu:goToDay', 1),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // ── Window ──
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },

    // ── Help ──
    {
      role: 'help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'Shift+?',
          click: () => send('koda:menu:shortcuts'),
        },
        { type: 'separator' },
        {
          label: 'Show Data Folder',
          click: () => send('koda:menu:openDataFolder'),
        },
        { type: 'separator' },
        {
          label: 'About Koda',
          click: () => send('koda:menu:about'),
        },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}

export function setupAppMenu(mainWindow: BrowserWindow | null): void {
  const menu = buildAppMenu(mainWindow)
  Menu.setApplicationMenu(menu)
}

export async function showAboutDialog(parent: BrowserWindow): Promise<void> {
  const result = await dialog.showMessageBox(parent, {
    type: 'info',
    title: 'About Koda',
    message: 'Koda',
    detail: `Version 0.1.0\n\nPersonal day planner with time-block calendar.\nBuilt offline-first — your data stays on your machine.\n\n© ${new Date().getFullYear()} klaschuk`,
    buttons: ['OK'],
    defaultId: 0,
  })
  void result
}

export function openExternalUrl(url: string): void {
  void shell.openExternal(url)
}
