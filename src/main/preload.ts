import { contextBridge, ipcRenderer } from 'electron'
import type { KodaAPI, TrayState, NotificationActionEvent } from '../shared/types'

// Listen for quick-add trigger from main process
ipcRenderer.on('koda:quickAdd', () => {
  window.dispatchEvent(new Event('koda:quickAdd'))
})

ipcRenderer.on('koda:openReview', () => {
  window.dispatchEvent(new Event('koda:openReview'))
})

// Bridge: tray state recompute request from main → main renderer
ipcRenderer.on('koda:trayRequestState', () => {
  window.dispatchEvent(new Event('koda:trayRequestState'))
})

const api: KodaAPI = {
  getDayData: (date) => ipcRenderer.invoke('koda:getDayData', date),
  saveDayData: (data) => ipcRenderer.invoke('koda:saveDayData', data),
  getSettings: () => ipcRenderer.invoke('koda:getSettings'),
  saveSettings: (settings) => ipcRenderer.invoke('koda:saveSettings', settings),
  getWeekStats: (startDate) => ipcRenderer.invoke('koda:getWeekStats', startDate),
  getMonthStats: (month) => ipcRenderer.invoke('koda:getMonthStats', month),
  getRangeStats: (startDate, endDate) => ipcRenderer.invoke('koda:getRangeStats', startDate, endDate),
  getAllDays: () => ipcRenderer.invoke('koda:getAllDays'),
  showNotification: (req) => ipcRenderer.invoke('koda:showNotification', req),
  getDataPath: () => ipcRenderer.invoke('koda:getDataPath'),
  getDataStats: () => ipcRenderer.invoke('koda:getDataStats'),
  setTheme: (theme) => ipcRenderer.invoke('koda:setTheme', theme),
  openDataFolder: () => ipcRenderer.invoke('koda:openDataFolder'),
  exportData: () => ipcRenderer.invoke('koda:exportData'),
  importData: () => ipcRenderer.invoke('koda:importData'),

  // Auto-launch
  getAutoLaunch: () => ipcRenderer.invoke('koda:getAutoLaunch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('koda:setAutoLaunch', enabled),

  // Tray
  pushTrayState: (state) => ipcRenderer.invoke('koda:pushTrayState', state),
  trayRequestState: () => ipcRenderer.invoke('koda:trayRequestState'),
  trayOpenMain: () => ipcRenderer.invoke('koda:trayOpenMain'),
  trayOpenQuickAdd: () => ipcRenderer.invoke('koda:trayOpenQuickAdd'),
  trayOpenReview: () => ipcRenderer.invoke('koda:trayOpenReview'),
  trayClosePopup: () => ipcRenderer.invoke('koda:trayClosePopup'),
  setTrayLabel: (label) => ipcRenderer.invoke('koda:setTrayLabel', label),

  // Dock
  setDockBadge: (text) => ipcRenderer.invoke('koda:setDockBadge', text),

  // Sound preview
  playSoundPreview: (pack) => ipcRenderer.invoke('koda:playSoundPreview', pack),

  // Events — return unsubscribe functions
  onQuickAdd: (cb) => {
    const handler = () => cb()
    window.addEventListener('koda:quickAdd', handler)
    return () => window.removeEventListener('koda:quickAdd', handler)
  },
  onTrayState: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, state: TrayState) => cb(state)
    ipcRenderer.on('koda:trayState', handler)
    return () => ipcRenderer.removeListener('koda:trayState', handler)
  },
  onNotificationAction: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, event: NotificationActionEvent) => cb(event)
    ipcRenderer.on('koda:notificationAction', handler)
    return () => ipcRenderer.removeListener('koda:notificationAction', handler)
  },
  onOpenReview: (cb) => {
    const handler = () => cb()
    window.addEventListener('koda:openReview', handler)
    return () => window.removeEventListener('koda:openReview', handler)
  },
}

// Forward menu events from main process to renderer (custom events)
const menuChannels = [
  'koda:menu:about',
  'koda:menu:quickAdd',
  'koda:menu:review',
  'koda:menu:shortcuts',
  'koda:menu:navigate',
  'koda:menu:goToToday',
  'koda:menu:goToDay',
  'koda:menu:exportData',
  'koda:menu:importData',
  'koda:menu:openDataFolder',
] as const

for (const channel of menuChannels) {
  ipcRenderer.on(channel, (_event, ...args) => {
    window.dispatchEvent(new CustomEvent(channel, { detail: args }))
  })
}

contextBridge.exposeInMainWorld('api', api)
