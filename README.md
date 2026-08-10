# TickPoint

**v1.0.0** — Lightweight, background-resident desktop time tracker for personal developer productivity.

TickPoint mirrors Jira-style estimation, logs work offline in SQLite, and stays available from the system tray with a compact always-on-top timer widget.

---

## Features

### Time tracking
- Single global active timer (start / pause / resume / stop)
- Auto-pause on sleep / screen-lock (time-gap detection)
- Mandatory session description when stopping a timer
- Floating always-on-top widget (hover expands controls to the left)
- Idle reminder every **2 minutes** when no timer is running or paused

### Tasks & estimates
- Story points: **0.5 · 1 · 2 · 3 · 5** only  
  (`1 SP = 1 working day = 8h = 480m`)
- Remaining time = estimate − logged (overtime shown with a red badge)
- Status lifecycle: `todo` → `in_progress` (on timer / log) → `done` (manual)
- High-priority tasks sort first
- Required **single tag** per task: Bug Fixing, Meetings, KT, Dev, INC Resolution, Maintenance, Planning
- Optional task description

### Worklogs
- Automatic segments from the live timer
- **Log Past Work** for manual backfills (task, start/end or duration, required description)
- Edit worklog start / end times and description

### Views
- **Tasks** — dense task table + worklog sidebar
- **Calendar** — week / month hour grid (`00:00` → next-day `00:00`) with overlapping block packing
- **Analytics** — estimation accuracy ratio, daily 8h capacity bar, tag distribution
- **To-Dos** — simple checklist; edit / delete open items; **Promote to Task** with SP + tag

### Export & backup
- **Export Weekly PDF** — Monday–Sunday summary for the current week
- Weekly automatic SQLite backups under `Documents/TickPoint/backups`
- One-click **Backup** / **Restore from Backup…**

### Desktop behavior
- Close-to-tray (Quit from tray menu)
- Version badge in the header (`v1.0.0`)

---

## Stack

| Layer | Tech |
| --- | --- |
| Shell | Tauri v2 (Rust) |
| UI | React 19 + TypeScript + Vite |
| Styles | Tailwind CSS + Lucide React + JetBrains Mono |
| Data | SQLite via `@tauri-apps/plugin-sql` (`timetracker.db`) |
| PDF | `jspdf` + `jspdf-autotable` |

---

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Rust](https://www.rust-lang.org/tools/install) + Cargo
- [Tauri platform dependencies](https://v2.tauri.app/start/prerequisites/)  
  On Windows: Visual Studio Build Tools with the C++ workload

---

## Develop

```bash
npm install
npm run tauri dev
```

Frontend-only (no native APIs / SQLite):

```bash
npm run dev
```

---

## Build

```bash
npm run tauri build
```

Installers are written under `src-tauri/target/release/bundle/`.

---

## Estimation cheat sheet

| Unit | Equals |
| --- | --- |
| 1 SP | 1d = 8h = 480m |
| 1w | 5d = 40h = 2400m |
| Example | 1.5 SP → 12h → `1d 4h` |

---

## Project layout

```
TickPoint/
├── src/                 # React UI, hooks, DB helpers
├── src-tauri/           # Tauri / Rust backend, migrations, tray, backups
├── package.json         # App version (keep in sync with tauri.conf.json)
└── README.md
```

---

## Notes

- Closing the main window **hides to tray**; use **Quit** in the tray menu to exit.
- Database file lives in the app config directory (`timetracker.db`).
- Backups: `Documents/TickPoint/backups/timetracker-*.sqlite`
- After a restore, restart the app so connections reload cleanly.

---

## License

Private / personal use unless you add a license file.
