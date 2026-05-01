// ── Category ──
export interface Category {
  id: string
  name: string
  icon: string
  color: string // hex color
}

// ── Time Block ──
export interface TimeBlock {
  id: string
  title: string
  categoryId: string
  startTime: string  // "HH:MM"
  endTime: string    // "HH:MM"
  completed: 'done' | 'partial' | 'skipped' | null
  note?: string
  // Real-time tracking (timer)
  actualStart?: string  // ISO timestamp when user pressed Start
  actualEnd?: string    // ISO timestamp when user pressed Stop
}

// ── Day Data ──
export interface DayData {
  date: string  // "YYYY-MM-DD"
  blocks: TimeBlock[]
  reviewed: boolean
  completionRate: number | null
  note?: string  // freeform daily note (mood, journal, intentions)
}

// ── Templates ──
export interface Template {
  id: string
  name: string                          // e.g. "Morning Routine"
  description?: string
  blocks: Array<{                       // template blocks (no id, no completed)
    title: string
    categoryId: string
    startTime: string
    endTime: string
  }>
}

// ── Pomodoro ──
export interface PomodoroSettings {
  workMinutes: number   // default 25
  breakMinutes: number  // default 5
  longBreakMinutes: number // default 15
  cyclesUntilLongBreak: number // default 4
}

// ── Settings ──
export type SoundPack = 'bell' | 'chime' | 'click' | 'none'

export interface NotificationSettings {
  enabled: boolean
  blockStart: boolean         // notify when block starts
  blockEnding: boolean        // notify 5 min before block ends
  overtime: boolean           // notify when block goes over
  idle: boolean               // notify after 30 min idle
  sound: boolean              // play sound on notifications
  soundPack: SoundPack        // which sound to play
}

export interface AppSettings {
  theme: 'dark' | 'light'
  categories: Category[]
  streak: number
  bestStreak: number
  lastActiveDate: string | null
  timelineStart: number
  timelineEnd: number

  // ── Extended settings ──
  weekStartsOn: 'monday' | 'sunday'
  defaultBlockDuration: number  // minutes, e.g. 60
  defaultCategoryId: string | null
  showCompletedBlocks: boolean
  autoStartReview: boolean      // auto open review at endOfDay
  reviewTime: number            // hour, default 21

  notifications: NotificationSettings

  // Productivity
  goalDailyHours: number        // target hours per day
  showWeekendsInStats: boolean
  autoLaunch: boolean           // start at login (macOS)

  // UI
  compactMode: boolean
  hourHeight: number            // px, default 72
  showSeconds: boolean

  // Templates
  templates: Template[]

  // Pomodoro
  pomodoro: PomodoroSettings
}

// ── Stats ──
export interface DayStats {
  totalPlanned: number   // minutes
  totalCompleted: number // minutes
  byCategory: Record<string, number>  // categoryId -> minutes
}

// ── Tray sync payload (main → popup) ──
export interface TrayState {
  date: string                   // YYYY-MM-DD (today)
  current: {
    blockId: string
    title: string
    categoryName: string
    categoryColor: string
    categoryIcon: string
    startTime: string
    endTime: string
    remainingMins: number
    progress: number             // 0..1
  } | null
  upcoming: Array<{
    blockId: string
    title: string
    categoryName: string
    categoryColor: string
    categoryIcon: string
    startTime: string
    endTime: string
  }>
  totals: {
    plannedMins: number
    completedMins: number
    completionPct: number        // 0..100
    blocksTotal: number
    blocksDone: number
    blocksRemaining: number
  }
  streak: number
  theme: 'dark' | 'light'
}

// ── Notification action payload (main → renderer) ──
export type NotificationActionType = 'done' | 'snooze' | 'skip' | 'open'

export interface NotificationActionEvent {
  blockId: string
  action: NotificationActionType
}

// ── Notification request (renderer → main) ──
export interface NotificationRequest {
  title: string
  body: string
  subtitle?: string
  blockId?: string
  withActions?: boolean          // include Mark Done / Snooze / Skip
  soundPack?: SoundPack
  silent?: boolean               // suppress OS sound
}

// ── IPC API exposed to renderer ──
export interface KodaAPI {
  // Day data
  getDayData: (date: string) => Promise<DayData>
  saveDayData: (data: DayData) => Promise<void>

  // Settings
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<void>

  // Stats
  getWeekStats: (startDate: string) => Promise<DayData[]>
  getMonthStats: (month: string) => Promise<DayData[]>
  getRangeStats: (startDate: string, endDate: string) => Promise<DayData[]>
  getAllDays: () => Promise<DayData[]>

  // System
  showNotification: (req: NotificationRequest) => Promise<void>
  getDataPath: () => Promise<string>
  getDataStats: () => Promise<{ bytes: number; daysCount: number }>
  setTheme: (theme: 'dark' | 'light') => Promise<void>
  openDataFolder: () => Promise<void>

  // Backup / Restore
  exportData: () => Promise<{
    success: boolean
    canceled?: boolean
    filePath?: string
    daysCount?: number
    error?: string
  }>
  importData: () => Promise<{
    success: boolean
    canceled?: boolean
    daysImported?: number
    daysOverwritten?: number
    settingsImported?: boolean
    strategy?: 'merge' | 'overwrite'
    error?: string
  }>

  // Auto-launch
  getAutoLaunch: () => Promise<boolean>
  setAutoLaunch: (enabled: boolean) => Promise<void>

  // Tray
  pushTrayState: (state: TrayState) => Promise<void>
  trayRequestState: () => Promise<void>
  trayOpenMain: () => Promise<void>
  trayOpenQuickAdd: () => Promise<void>
  trayOpenReview: () => Promise<void>
  trayClosePopup: () => Promise<void>
  setTrayLabel: (label: string) => Promise<void>

  // Dock
  setDockBadge: (text: string) => Promise<void>

  // Sound preview
  playSoundPreview: (pack: SoundPack) => Promise<void>

  // Events
  onQuickAdd: (cb: () => void) => () => void
  onTrayState: (cb: (state: TrayState) => void) => () => void
  onNotificationAction: (cb: (event: NotificationActionEvent) => void) => () => void
  onOpenReview: (cb: () => void) => () => void
}

// ── Default categories ──
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'morning', name: 'Morning', icon: '\u{2600}\u{FE0F}',     color: '#fbbf24' }, // ☀️ amber
  { id: 'english', name: 'English', icon: '\u{1F1EC}\u{1F1E7}', color: '#22c55e' }, // 🇬🇧 green
  { id: 'music',   name: 'Music',   icon: '\u{1F3B7}',           color: '#ec4899' }, // 🎷 pink
  { id: 'it',      name: 'IT',      icon: '\u{1F4BB}',           color: '#6366f1' }, // 💻 indigo
  { id: 'sport',   name: 'Sport',   icon: '\u{1F3C3}',           color: '#f97316' }, // 🏃 orange
  { id: 'youtube', name: 'YouTube', icon: '\u{1F3AC}',           color: '#a855f7' }, // 🎬 purple
  { id: 'home',    name: 'Home',    icon: '\u{1F3E0}',           color: '#14b8a6' }, // 🏠 teal
  { id: 'free',    name: 'Free',    icon: '\u{2728}',             color: '#38bdf8' }, // ✨ sky
  { id: 'rest',    name: 'Rest',    icon: '\u{1F634}',           color: '#64748b' }, // 😴 slate
  { id: 'sleep',   name: 'Sleep',   icon: '\u{1F319}',           color: '#1e293b' }, // 🌙 deep slate
]

// ── Ideal Day template (Russian-friendly schedule for the user) ──
export const IDEAL_DAY_TEMPLATE: Template = {
  id: 'ideal-day',
  name: 'Ideal Day',
  description: 'Полный день: подъём, английский, сакс, IT, спорт, YouTube, отдых',
  blocks: [
    { title: 'Подъём, душ, вода',                      categoryId: 'morning', startTime: '07:00', endTime: '07:15' },
    { title: 'Завтрак',                                 categoryId: 'morning', startTime: '07:15', endTime: '07:45' },
    { title: 'Английский — shadowing, подкаст',         categoryId: 'english', startTime: '07:45', endTime: '08:45' },
    { title: 'Сакс — блок 1, техника и гаммы',          categoryId: 'music',   startTime: '08:45', endTime: '09:45' },
    { title: 'IT — блок 1, одна конкретная тема',       categoryId: 'it',      startTime: '09:45', endTime: '11:00' },
    { title: 'Спорт — зал или плавание',                categoryId: 'sport',   startTime: '11:00', endTime: '12:30' },
    { title: 'Обед + отдых',                            categoryId: 'rest',    startTime: '12:30', endTime: '13:15' },
    { title: 'Сакс — блок 2, репертуар',                categoryId: 'music',   startTime: '13:15', endTime: '14:15' },
    { title: 'YouTube — скрипт, съёмка или монтаж',     categoryId: 'youtube', startTime: '14:15', endTime: '15:45' },
    { title: 'IT — блок 2, практика на сервере',        categoryId: 'it',      startTime: '15:45', endTime: '17:00' },
    { title: 'Сакс — блок 3, прогон дня',               categoryId: 'music',   startTime: '17:00', endTime: '18:00' },
    { title: 'Уборка',                                  categoryId: 'home',    startTime: '18:00', endTime: '18:30' },
    { title: 'Ужин',                                    categoryId: 'morning', startTime: '18:30', endTime: '19:15' },
    { title: 'Свободное время',                         categoryId: 'free',    startTime: '19:15', endTime: '20:15' },
    { title: 'Вечер — сериал, книга',                   categoryId: 'rest',    startTime: '20:15', endTime: '22:30' },
    { title: 'Подготовка ко сну',                       categoryId: 'rest',    startTime: '22:30', endTime: '23:00' },
    // Note: 23:00 → 07:00 sleep block is omitted because it crosses midnight
    // and would conflict with the next day's 07:00 morning block.
  ],
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  categories: DEFAULT_CATEGORIES,
  streak: 0,
  bestStreak: 0,
  lastActiveDate: null,
  timelineStart: 7,
  timelineEnd: 23,
  weekStartsOn: 'monday',
  defaultBlockDuration: 60,
  defaultCategoryId: null,
  showCompletedBlocks: true,
  autoStartReview: false,
  reviewTime: 21,
  notifications: {
    enabled: true,
    blockStart: true,
    blockEnding: true,
    overtime: true,
    idle: false,
    sound: true,
    soundPack: 'bell',
  },
  goalDailyHours: 8,
  showWeekendsInStats: true,
  autoLaunch: false,
  compactMode: false,
  hourHeight: 72,
  showSeconds: false,
  templates: [IDEAL_DAY_TEMPLATE],
  pomodoro: {
    workMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    cyclesUntilLongBreak: 4,
  },
}
