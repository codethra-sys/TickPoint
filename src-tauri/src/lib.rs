use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{
    menu::{Menu, MenuItem},
    path::BaseDirectory,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_sql::{Migration, MigrationKind};

#[tauri::command]
fn save_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

fn db_file(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resolve("timetracker.db", BaseDirectory::AppConfig)
        .map_err(|e| e.to_string())
}

fn backup_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let docs = app
        .path()
        .document_dir()
        .map_err(|e| e.to_string())?;
    let dir = docs.join("TickPoint").join("backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn stamp() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // YYYYMMDD-ish via simple epoch day; readable enough for backups
    let days = secs / 86400;
    let rem = secs % 86400;
    let h = rem / 3600;
    let m = (rem % 3600) / 60;
    format!("day{days}_{h:02}{m:02}")
}

fn copy_backup(app: &AppHandle) -> Result<String, String> {
    let src = db_file(app)?;
    if !src.exists() {
        return Err("Database file not found yet. Use the app once first.".into());
    }
    let dir = backup_dir(app)?;
    let dest = dir.join(format!("timetracker-{}.sqlite", stamp()));
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;

    let marker = dir.join(".last_weekly_backup");
    let _ = fs::write(&marker, format!("{}", secs_now()));

    Ok(dest.to_string_lossy().to_string())
}

fn secs_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[tauri::command]
fn backup_database(app: AppHandle) -> Result<String, String> {
    copy_backup(&app)
}

#[tauri::command]
fn restore_database(app: AppHandle, path: String) -> Result<(), String> {
    let src = PathBuf::from(path);
    if !src.exists() {
        return Err("Backup file not found".into());
    }
    let dest = db_file(&app)?;
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(())
}

fn maybe_weekly_backup(app: &AppHandle) {
    let Ok(dir) = backup_dir(app) else { return };
    let marker = dir.join(".last_weekly_backup");
    let due = match fs::read_to_string(&marker) {
        Ok(s) => s
            .trim()
            .parse::<u64>()
            .map(|t| secs_now().saturating_sub(t) >= 7 * 24 * 3600)
            .unwrap_or(true),
        Err(_) => true,
    };
    if due {
        let _ = copy_backup(app);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_tasks_and_worklogs",
            sql: r#"
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    story_points REAL NOT NULL,
    original_estimate_mins INTEGER NOT NULL,
    status TEXT CHECK(status IN ('todo', 'in_progress', 'done')) NOT NULL DEFAULT 'todo',
    is_high_priority BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS worklogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_mins INTEGER NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_worklogs_task_id ON worklogs(task_id);
CREATE INDEX IF NOT EXISTS idx_worklogs_start_time ON worklogs(start_time);
"#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "task_description_tags_and_todos",
            sql: r#"
ALTER TABLE tasks ADD COLUMN description TEXT;
ALTER TABLE tasks ADD COLUMN tags TEXT DEFAULT '[]';

CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    is_done BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
"#,
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:timetracker.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            save_file,
            backup_database,
            restore_database
        ])
        .setup(|app| {
            maybe_weekly_backup(app.handle());

            let show_i = MenuItem::with_id(app, "show", "Show TickPoint", true, None::<&str>)?;
            let backup_i = MenuItem::with_id(app, "backup", "Backup Database", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &backup_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("TickPoint")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "backup" => {
                        let _ = copy_backup(app);
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            let widget_url = if cfg!(debug_assertions) {
                WebviewUrl::External(
                    "http://localhost:1420/?widget=1"
                        .parse()
                        .expect("widget url"),
                )
            } else {
                WebviewUrl::App("index.html?widget=1".into())
            };

            let widget = WebviewWindowBuilder::new(app, "widget", widget_url)
                .title("TickPoint Timer")
                .inner_size(48.0, 48.0)
                .resizable(false)
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .visible(false)
                .focused(false)
                .build()?;

            if let Ok(Some(monitor)) = widget.current_monitor() {
                let screen = monitor.size();
                let scale = monitor.scale_factor();
                let margin = 24.0;
                let x = (screen.width as f64 / scale) - 48.0 - margin;
                let y = margin + 48.0;
                let _ = widget.set_position(tauri::LogicalPosition::new(x, y));
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
