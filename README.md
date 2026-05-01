# Koda

Personal day planner with time-block calendar. Built offline-first as a desktop app for macOS.

> Plan your day with visual time blocks. Stay focused with countdown timers, native notifications, and a tray-icon mini view. Build streaks with daily reviews.

![Koda](assets/icon.svg)

## Features

- **Visual timeline** (07:00–23:00 by default) with drag-to-create, drag-to-move, resize blocks
- **Parallel blocks** — overlapping tasks render side-by-side as columns
- **Categories** with custom icons and colors (10 defaults: Morning, English, Music, IT, Sport, YouTube, Home, Free, Rest, Sleep)
- **Templates** — save reusable day structures (Ideal Day shipped pre-loaded)
- **Pomodoro mode** — work/break cycles synced with current block
- **Block timer** — track real time spent vs planned
- **Smart notifications** — block start, ending soon (5 min), overtime, idle detection
- **Native macOS tray** — live label with current block + remaining time, popup with day overview
- **Day Review** — animated end-of-day flow with score card and streak tracking
- **Search** (⌘F) across all blocks
- **Undo / Redo** (⌘Z / ⌘⇧Z)
- **Multi-select** — ⌘+click, shift+click for ranges
- **Stats** — heatmap, weekly trend, energy map, category breakdown
- **Daily Goal** progress tracking
- **Day Notes** — freeform journal per day
- **Backup / Restore** — JSON export with merge or overwrite
- **Auto-launch** at login (macOS)
- **Theme** — Dark (Midnight Neon) / Light, plus tray popup theme sync
- **Keyboard shortcuts** — comprehensive coverage with cheat sheet (`?`)
- **Window state persistence** — remembers size, position, maximized state
- **ErrorBoundary** — graceful crash recovery

## Tech

- **Electron 29** (frameless macOS window, hiddenInset titlebar)
- **React 19** + **TypeScript 5** + **Vite 5**
- **Tailwind CSS 3** with CSS-variable-driven theming
- **Lucide React** icons
- **Inter** + **JetBrains Mono** (bundled, offline)
- Local-only storage as JSON files in `~/Library/Application Support/koda/koda-data/`

## Architecture

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # Entry, window creation, global shortcuts
│   ├── menu.ts              # Native macOS application menu
│   ├── tray.ts              # Menubar tray icon + popup window
│   ├── notifications.ts     # Rich native notifications with actions
│   ├── preload.ts           # contextBridge IPC API
│   ├── ipc/handlers.ts      # IPC method implementations
│   └── services/
│       ├── storage.ts       # JSON file CRUD, backup/restore, migrations
│       └── windowState.ts   # Window position/size persistence
├── renderer/                # React UI
│   ├── App.tsx              # Root, page routing, modals, hotkeys
│   ├── pages/               # Dashboard, Planner, Calendar, Stats, Settings
│   ├── components/          # Timeline, Sidebar, FocusPanel, Toast, etc.
│   ├── hooks/               # useAppState, useUndo, useTimer, useNotifications
│   ├── tray.tsx             # Separate entry for tray popup window
│   ├── styles/globals.css   # Tailwind + CSS variables (Midnight Neon palette)
│   └── fonts/               # Bundled Inter + JetBrains Mono
└── shared/
    ├── types.ts             # TimeBlock, DayData, AppSettings, KodaAPI, IDEAL_DAY_TEMPLATE
    └── utils.ts             # Time formatting, layout algorithm for parallel blocks
```

## Develop

```bash
npm install
npm run dev      # Vite + Electron with HMR (port 5174)
```

## Build

```bash
npm run build       # TS + Vite build, output to dist/
npm run package:mac # Builds .dmg for x64 + arm64 → release/
npm run package:win # Builds .exe (NSIS installer) for x64 → release/
```

> macOS DMG is **not code-signed** by default. To distribute, set up an Apple Developer account ($99/year) and configure `electron-builder` signing. For personal use, right-click the app → Open → Confirm to bypass Gatekeeper warnings.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ⌘K / ⌘N | Quick Add Block |
| ⌘R | Review Day |
| ⌘F | Search Blocks |
| ⌘Z / ⌘⇧Z | Undo / Redo |
| ⌘1–4 | Switch pages (Dashboard / Planner / Calendar / Stats) |
| ⌘, | Settings |
| T | Jump to Today |
| ← → | Previous / Next Day |
| D | Mark current block done |
| ? | Show all shortcuts |
| Esc | Close modal |
| ⌘⌥K | Global Quick Add (works system-wide) |

## License

MIT
