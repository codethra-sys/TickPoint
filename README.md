# TickPoint

Lightweight background-resident desktop time tracker for personal developer productivity. Mirrors Jira estimation paradigms and stores everything offline in SQLite.

## Stack

- Tauri v2 (Rust) + React + TypeScript + Vite
- SQLite via `@tauri-apps/plugin-sql` (`timetracker.db`)
- Tailwind CSS + Lucide React + JetBrains Mono
- PDF export with `jspdf` + `jspdf-autotable`

## Domain rules

- **1 SP = 1 working day = 8h = 480m**
- Remaining = original estimate − logged time (negative shows as overtime)
- Status: `todo` → `in_progress` (on timer/log) → `done` (manual only)
- Single active timer; pause on manual pause or sleep/lock time-gap
- Idle reminder every 15 minutes when nothing is running or paused

## Develop

Prerequisites: [Rust](https://www.rust-lang.org/tools/install), Node.js, and [Tauri OS deps](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

Closing the window hides to the system tray; use the tray menu to quit.
