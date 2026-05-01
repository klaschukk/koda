import { IpcMain, dialog, shell, BrowserWindow } from 'electron'
import fs from 'fs'
import {
  readDayData,
  writeDayData,
  readSettings,
  writeSettings,
  readWeekData,
  readMonthData,
  readRangeData,
  readAllDays,
  getDataPath,
  getDataStats,
  exportAllData,
  importBackup,
} from '../services/storage'

export function registerHandlers(ipcMain: IpcMain): void {
  // Day data
  ipcMain.handle('koda:getDayData', (_e, date: string) => {
    return readDayData(date)
  })

  ipcMain.handle('koda:saveDayData', (_e, data) => {
    writeDayData(data)
  })

  // Settings
  ipcMain.handle('koda:getSettings', () => {
    return readSettings()
  })

  ipcMain.handle('koda:saveSettings', (_e, settings) => {
    writeSettings(settings)
  })

  // Stats
  ipcMain.handle('koda:getWeekStats', (_e, startDate: string) => {
    return readWeekData(startDate)
  })

  ipcMain.handle('koda:getMonthStats', (_e, month: string) => {
    return readMonthData(month)
  })

  ipcMain.handle('koda:getRangeStats', (_e, startDate: string, endDate: string) => {
    return readRangeData(startDate, endDate)
  })

  ipcMain.handle('koda:getAllDays', () => {
    return readAllDays()
  })

  // System
  // Note: koda:showNotification is registered in main/index.ts where it can
  // forward action events back to the focused main window.

  ipcMain.handle('koda:getDataPath', () => {
    return getDataPath()
  })

  ipcMain.handle('koda:openDataFolder', () => {
    void shell.openPath(getDataPath())
  })

  ipcMain.handle('koda:getDataStats', () => {
    return getDataStats()
  })

  // ── Backup / Restore ──
  ipcMain.handle('koda:exportData', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return { success: false, error: 'No window' }

    const today = new Date().toISOString().split('T')[0]
    const result = await dialog.showSaveDialog(win, {
      title: 'Export Koda Data',
      defaultPath: `koda-backup-${today}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    try {
      const backup = exportAllData()
      fs.writeFileSync(result.filePath, JSON.stringify(backup, null, 2), 'utf-8')
      return {
        success: true,
        filePath: result.filePath,
        daysCount: backup.days.length,
      }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('koda:importData', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return { success: false, error: 'No window' }

    const fileResult = await dialog.showOpenDialog(win, {
      title: 'Import Koda Data',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })

    if (fileResult.canceled || fileResult.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    // Ask user about strategy
    const strategyDialog = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Cancel', 'Merge (keep existing)', 'Overwrite all'],
      defaultId: 1,
      cancelId: 0,
      title: 'Import Strategy',
      message: 'How should existing data be handled?',
      detail: 'Merge: only days that don\'t exist will be imported.\nOverwrite: existing days will be replaced with backup.',
    })

    if (strategyDialog.response === 0) {
      return { success: false, canceled: true }
    }

    const strategy = strategyDialog.response === 2 ? 'overwrite' : 'merge'

    try {
      const raw = fs.readFileSync(fileResult.filePaths[0], 'utf-8')
      const backup = JSON.parse(raw)
      const imported = importBackup(backup, strategy)
      return { success: true, ...imported, strategy }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
