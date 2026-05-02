# CLAUDE.md

Guidance for AI assistants working in this repo.

## Project Overview

**Koda** is a personal day planner — a desktop Electron app for macOS (Windows config exists but untested). It is a finished personal-use product, not actively developed. Single user, offline-first, no backend.

The app's owner has stopped active development and is just using it. Future work is most likely **bug fixes** or **incidental improvements**, not new features.

## Tech Stack

- **Electron 29** (frameless, hiddenInset titlebar) + Node.js main process
- **React 19** + **TypeScript 5** (strict mode) + **Vite 5** for the renderer
- **Tailwind CSS 3** with CSS-variable-driven theming (NOT class-based dark mode)
- **Lucide React** for icons (no emojis in UI chrome — only in user-customizable category icons)
- **uuid** for block IDs
- **Inter** + **JetBrains Mono** bundled locally in `src/renderer/fonts/` (no Google Fonts CDN)

No state management library. No router. No CSS-in-JS. Component state + `useAppState` hook + window event bus.

## Architecture

```
src/
├── main/                    # Electron main process (Node)
│   ├── index.ts             # Entry, window creation, global shortcuts, IPC wiring
│   ├── menu.ts              # Native macOS application menu (File / Edit / View / etc)
│   ├── tray.ts              # Menubar tray icon, popup BrowserWindow, label updates
│   ├── notifications.ts     # Rich native notifications with action buttons + sounds
│   ├── preload.ts           # contextBridge exposes `window.api` to renderer
│   ├── ipc/handlers.ts      # All ipcMain.handle definitions
│   └── services/
│       ├── storage.ts       # JSON file CRUD with corruption recovery + atomic writes
│       └── windowState.ts   # Persists window position/size across launches
│
├── renderer/                # React UI (Vite)
│   ├── App.tsx              # Root: page routing, modals, hotkeys, menu event bridge
│   ├── pages/
│   │   ├── Dashboard.tsx    # Home screen: greeting, focus card, goal, day note, week bars
│   │   ├── Planner.tsx      # 3-column: Sidebar | Timeline | FocusPanel
│   │   ├── Calendar.tsx     # Monthly grid with heat colors
│   │   ├── Stats.tsx        # Heatmap, weekly chart, energy map, category cards
│   │   └── SettingsPage.tsx # 9-tab settings (appearance, timeline, categories, …)
│   ├── components/
│   │   ├── Timeline.tsx     # The main canvas: drag-create, multi-select, parallel layout
│   │   ├── Sidebar.tsx      # Date nav + today's stats + Load Ideal Day CTA
│   │   ├── FocusPanel.tsx   # Current block, countdown, block timer, Pomodoro toggle
│   │   ├── QuickAdd.tsx     # ⌘K modal — title, category, time, optional notes
│   │   ├── DayReview.tsx    # End-of-day flow: per-block status → animated score card
│   │   ├── DayNote.tsx      # Auto-saving freeform daily journal field
│   │   ├── ShortcutsModal.tsx  # ? key cheat sheet
│   │   ├── Toast.tsx        # In-app notification queue (also sent to OS)
│   │   ├── ErrorBoundary.tsx   # Catches render crashes, offers reload
│   │   ├── Welcome.tsx      # First-launch onboarding
│   │   ├── PomodoroPanel.tsx
│   │   ├── SearchBar.tsx    # ⌘F across all blocks
│   │   ├── TemplatesEditor.tsx
│   │   └── NavBar.tsx       # 5 page-switcher icons on the far left
│   ├── hooks/
│   │   ├── useAppState.ts   # The big one: settings + dayData + all block CRUD + undo wiring
│   │   ├── useUndo.ts       # Simple action stack with inverses
│   │   ├── useNotifications.ts  # Time-based triggers for OS + toast notifications
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useTimer.ts      # Stopwatch hook for Pomodoro / block tracking
│   │   └── useTraySync.ts   # Pushes current state to tray/popup on change
│   ├── tray.tsx             # SEPARATE entry point for the tray popup window
│   ├── tray.html
│   ├── tray/TrayPopup.tsx
│   ├── styles/globals.css   # Theme variables, Tailwind directives, animations
│   └── fonts/               # Bundled .ttf files
│
└── shared/
    ├── types.ts             # All TypeScript types + DEFAULT_SETTINGS, DEFAULT_CATEGORIES, IDEAL_DAY_TEMPLATE
    └── utils.ts             # timeToMinutes, formatDuration, layoutOverlappingBlocks
```

## Key Conventions

### CSS variables, not Tailwind dark mode

The app uses CSS variables in `globals.css` for theming. The `.light` class on `<html>` swaps the `:root` variables. This means:

- ✅ Use `style={{ color: 'var(--text)' }}` for theme-aware colors
- ✅ Use `className="bg-[var(--surface)]"` (Tailwind arbitrary values) when tailwind classes can't reach
- ❌ Do **not** use Tailwind `dark:` modifiers — they won't fire because we don't toggle `.dark`
- ❌ Do not import Tailwind colors that don't respect the theme

This is why every component has tons of inline `style={{ color: 'var(--…)' }}`. ESLint warns about it. Ignore the warnings — it's intentional.

### IPC contract

All renderer→main calls go through `window.api` typed by `KodaAPI` in `shared/types.ts`. Adding a new IPC method requires updating **three** places:

1. `shared/types.ts` → add to `KodaAPI` interface
2. `main/preload.ts` → add the `ipcRenderer.invoke` wrapper
3. `main/ipc/handlers.ts` (or `main/index.ts` for ones that need window access) → add the handler

If any of the three is missing, TypeScript will yell at you.

### Storage is JSON files, atomic writes

- Settings: `~/Library/Application Support/koda/koda-data/settings.json`
- Days: `~/Library/Application Support/koda/koda-data/days/YYYY-MM-DD.json` (one file per day)
- Window state: `~/Library/Application Support/koda/koda-data/window-state.json`
- Corrupted files quarantined to `…/koda-data/corrupted/` with timestamp suffix

Writes go through `writeFileAtomic` (write to `.tmp`, rename) so a crash mid-save doesn't lose the file. Reads validate shape and quarantine bad files instead of crashing.

### Block layout (parallel tasks)

Overlapping blocks render side-by-side as columns. The algorithm is in `shared/utils.ts → layoutOverlappingBlocks`:

1. Sort blocks by start time, then duration desc
2. Greedy: for each block, find the earliest column where it fits without overlap
3. Group into clusters where any chain of overlap exists
4. Each block knows its `col` index and total `totalCols` in its cluster

Timeline.tsx uses this to compute `width` and `left` CSS for each block.

### Theming the Electron window

The window's `backgroundColor` (set via `mainWindow.setBackgroundColor()`) needs to match the renderer's bg color, otherwise you see a flash on launch and during resize. `koda:setTheme` IPC handles this — see `main/index.ts`.

The tray popup is a **separate BrowserWindow** loading `tray.html`. Its theme syncs through `pushTrayState` IPC which carries the theme name.

### Default categories changed mid-development

Originally: `code, english, video, sport, rest, other`. Later expanded to 10: `morning, english, music, it, sport, youtube, home, free, rest, sleep`. The migration in `storage.ts → readSettings` adds missing categories without touching the user's customizations. Don't remove this migration.

The `IDEAL_DAY_TEMPLATE` constant in `shared/types.ts` references those category IDs — keep them in sync.

## Common Tasks

### Add a new IPC method

1. Define in `KodaAPI` (shared/types.ts)
2. Wire in `preload.ts`
3. Implement in `main/ipc/handlers.ts` or `main/index.ts`
4. Use as `window.api.yourMethod(...)` in renderer

### Add a new keyboard shortcut

1. Add handler key to `ShortcutHandlers` in `useKeyboardShortcuts.ts`
2. Add the shortcut display row to `SHORTCUTS` array (so it shows in cheat sheet)
3. Add the key matcher inside the `handler` function
4. In `App.tsx`, pass the actual handler to `useKeyboardShortcuts({ ... })`

### Add a new block field

1. Extend `TimeBlock` in `shared/types.ts` (mark as optional with `?`)
2. UI to set it lives in QuickAdd / Timeline context menu / DayReview
3. Storage layer is field-agnostic — just JSON.stringify, no schema needed
4. Stats / Calendar / etc. that consume blocks may want to display it

### Build and ship

```bash
npm run build         # TypeScript + Vite
npm run package:mac   # Builds .dmg for x64 + arm64 → release/
```

Output: `release/Koda-0.1.0.dmg` (Intel) and `release/Koda-0.1.0-arm64.dmg` (Apple Silicon).

The DMG is **not code-signed**. macOS will say "from an unidentified developer". User has to right-click → Open → confirm once.

### Don't introduce

- A state manager (Redux/Zustand). useAppState + props is fine for this scale.
- A router. Page is just `useState<Page>`.
- A CSS-in-JS lib. Tailwind + CSS vars are intentional.
- New emojis as hardcoded UI icons. Use Lucide. Emojis are only allowed in user-editable category icons.
- Auto-update infra unless really needed. The owner doesn't want to manage releases.
- Network calls. App is offline-first, no backend, no telemetry, no analytics.
- ESLint inline-style fixes. The warnings are intentional — see "CSS variables" above.

## Safety Notes

- Storage layer is the **only** place that touches the file system. Don't add `fs` calls elsewhere.
- All renderer code runs in `contextIsolation: true` — `window.require` is undefined. Always go through `window.api`.
- The tray popup window shares storage but is a separate React tree. Don't import shared state from the main renderer into `tray.tsx`.
- `nativeTheme.themeSource` is set to follow the user's choice (`'dark' | 'light'`), not `'system'`. This is intentional so notifications + dialogs match the in-app theme.

## Known Limitations (not bugs)

- Sleep block 23:00 → 07:00 is intentionally omitted from the Ideal Day template — blocks crossing midnight aren't supported (would conflict with next day's 07:00 morning block).
- Native notifications on macOS only show action buttons if the user has set Koda's notification style to "Alerts" in System Settings → Notifications.
- The `code-signing` warning during `package:mac` is expected — owner declined Apple Developer subscription.

## Definitely Don't Touch

- `src/renderer/fonts/*.ttf` — bundled offline, replacing requires re-running font download
- `assets/icon.icns` / `.ico` / `.svg` — final brand identity, generated, do not regenerate without strong reason
- `electron-builder.json` — signed-off config, only modify on explicit request
