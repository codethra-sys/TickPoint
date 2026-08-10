import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  DatabaseBackup,
  FileDown,
  History,
  ListTodo,
  Plus,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TimerBar } from "./components/TimerBar";
import { TaskList } from "./components/TaskList";
import { TaskForm } from "./components/TaskForm";
import { WorklogPanel } from "./components/WorklogPanel";
import { IdleModal } from "./components/IdleModal";
import { SessionDescriptionModal } from "./components/SessionDescriptionModal";
import { CalendarView } from "./components/CalendarView";
import { LogPastWorkModal } from "./components/LogPastWorkModal";
import { EditWorklogModal } from "./components/EditWorklogModal";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { TodoListPanel } from "./components/TodoListPanel";
import { PausedBadge } from "./components/StatusBadge";
import { useTimer } from "./hooks/useTimer";
import { useIdleReminder } from "./hooks/useIdleReminder";
import {
  addWorklog,
  createTask,
  createTodo,
  deleteTask,
  deleteTodo,
  deleteWorklog,
  listTasks,
  listTodos,
  listWorklogs,
  setTaskStatus,
  updateTask,
  updateTodo,
  updateWorklog,
} from "./lib/db";
import { exportWeeklyReportPdf } from "./lib/pdf";
import type {
  TaskStatus,
  TaskTag,
  TaskWithStats,
  TodoItem,
  Worklog,
} from "./types";

type MainView = "tasks" | "calendar" | "analytics" | "todos";

export default function App() {
  const [tasks, setTasks] = useState<TaskWithStats[]>([]);
  const [worklogs, setWorklogs] = useState<Worklog[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TaskWithStats | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<MainView>("tasks");
  const [exporting, setExporting] = useState(false);
  const [showLogPast, setShowLogPast] = useState(false);
  const [editingWorklog, setEditingWorklog] = useState<Worklog | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("1.0.0");

  useEffect(() => {
    void getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion("1.0.0"));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [t, w, td] = await Promise.all([
        listTasks(),
        listWorklogs(),
        listTodos(),
      ]);
      setTasks(t);
      setWorklogs(w);
      setTodos(td);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load data. Is the SQLite plugin available?",
      );
    } finally {
      setReady(true);
    }
  }, []);

  const timer = useTimer(() => {
    void refresh();
  });

  const idle = useIdleReminder(timer.phase, !timer.pendingStop);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (timer.pendingStop) {
      void getCurrentWindow().show();
      void getCurrentWindow().setFocus();
    }
  }, [timer.pendingStop]);

  useEffect(() => {
    if (timer.isPaused && timer.taskTitle) {
      document.title = `⏸ Paused: ${timer.taskTitle} — TickPoint`;
    } else if (timer.isRunning && timer.taskTitle) {
      document.title = `▶ ${timer.taskTitle} — TickPoint`;
    } else {
      document.title = "TickPoint";
    }
  }, [timer.isPaused, timer.isRunning, timer.taskTitle]);

  async function handleCreate(values: {
    title: string;
    story_points: number;
    status: TaskStatus;
    is_high_priority: boolean;
    description: string | null;
    tag: TaskTag;
  }) {
    await createTask({
      title: values.title,
      story_points: values.story_points,
      is_high_priority: values.is_high_priority,
      description: values.description,
      tag: values.tag,
    });
    setShowForm(false);
    await refresh();
  }

  async function handleUpdate(values: {
    title: string;
    story_points: number;
    status: TaskStatus;
    is_high_priority: boolean;
    description: string | null;
    tag: TaskTag;
  }) {
    if (!editing) return;
    await updateTask(editing.id, values);
    setEditing(null);
    setShowForm(false);
    await refresh();
  }

  async function handleDelete(task: TaskWithStats) {
    if (!confirm(`Delete “${task.title}” and all its worklogs?`)) return;
    if (timer.taskId === task.id) {
      timer.requestStop();
      return;
    }
    await deleteTask(task.id);
    if (selectedId === task.id) setSelectedId(null);
    await refresh();
  }

  async function handleMarkDone(task: TaskWithStats) {
    if (timer.taskId === task.id && timer.phase !== "idle") {
      timer.requestStop();
      return;
    }
    await setTaskStatus(task.id, "done");
    await refresh();
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportWeeklyReportPdf(tasks, worklogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleBackup() {
    try {
      const path = await invoke<string>("backup_database");
      setBackupMsg(`Backup saved: ${path}`);
      setTimeout(() => setBackupMsg(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRestore() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "SQLite", extensions: ["sqlite", "db"] }],
      });
      if (!selected || Array.isArray(selected)) return;
      if (
        !confirm(
          "Restore will overwrite the current database. Restart the app after restore. Continue?",
        )
      ) {
        return;
      }
      await invoke("restore_database", { path: selected });
      setBackupMsg("Database restored. Please restart TickPoint.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handlePromote(
    todo: TodoItem,
    storyPoints: number,
    tag: TaskTag,
  ) {
    await createTask({
      title: todo.title,
      story_points: storyPoints,
      description: null,
      tag,
    });
    await deleteTodo(todo.id);
    setView("tasks");
    await refresh();
  }

  const filteredWorklogs =
    selectedId == null
      ? worklogs
      : worklogs.filter((w) => w.task_id === selectedId);

  const navBtn = (id: MainView, label: string, icon: ReactNode) => (
    <button
      type="button"
      onClick={() => setView(id)}
      className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-sm ${
        view === id
          ? "bg-[var(--color-panel-2)] text-[var(--color-text)] shadow-sm"
          : "text-[var(--color-muted)] hover:bg-[var(--color-panel-2)]/70 hover:text-[var(--color-text)]"
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-panel)]/55 px-4 py-3 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">
              Tick<span className="text-[var(--color-accent)]">Point</span>
            </h1>
            <span
              className="mono rounded-md border border-[var(--color-line)] bg-[var(--color-panel-2)]/80 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-[var(--color-muted)]"
              title={`TickPoint v${appVersion}`}
            >
              v{appVersion}
            </span>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Jira-style estimates · automatic daily activity log
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {timer.isPaused && timer.taskTitle && (
            <div className="hidden lg:block">
              <PausedBadge title={timer.taskTitle} />
            </div>
          )}
          <div className="flex h-8 flex-wrap items-center rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]/70 p-0.5">
            {navBtn("tasks", "Tasks", <ListTodo size={14} />)}
            {navBtn("calendar", "Calendar", <CalendarDays size={14} />)}
            {navBtn("analytics", "Analytics", <BarChart3 size={14} />)}
            {navBtn("todos", "To-Dos", <CheckSquare size={14} />)}
          </div>
          <button
            type="button"
            onClick={() => setShowLogPast(true)}
            className="btn btn-secondary"
          >
            <History size={14} /> Log Past Work
          </button>
          <button
            type="button"
            onClick={() => void handleBackup()}
            className="btn btn-secondary"
            title="Save a .sqlite backup to Documents/TickPoint/backups"
          >
            <DatabaseBackup size={14} /> Backup
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="btn btn-secondary"
          >
            <FileDown size={14} />{" "}
            {exporting ? "Exporting…" : "Export Weekly PDF"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
              setView("tasks");
            }}
            className="btn btn-primary"
          >
            <Plus size={14} /> New Task
          </button>
        </div>
      </header>

      <TimerBar
        snapshot={timer.snapshot}
        onPause={() => void timer.pause()}
        onResume={() => void timer.resume()}
        onStop={() => timer.requestStop()}
      />

      {(error || backupMsg) && (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] px-4 py-2 text-sm">
          {error && (
            <p className="text-[var(--color-danger)]">{error}</p>
          )}
          {backupMsg && (
            <p className="text-[var(--color-accent)]">{backupMsg}</p>
          )}
          <button
            type="button"
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
            onClick={() => {
              setError(null);
              setBackupMsg(null);
            }}
          >
            Dismiss
          </button>
          {backupMsg?.includes("restored") && (
            <button
              type="button"
              className="btn btn-secondary h-7 text-xs"
              onClick={() => void handleRestore()}
            >
              Pick another…
            </button>
          )}
        </div>
      )}

      {view === "calendar" ? (
        <main className="min-h-0 flex-1 overflow-hidden p-4">
          <CalendarView worklogs={worklogs} tasks={tasks} />
        </main>
      ) : view === "analytics" ? (
        <main className="min-h-0 flex-1 overflow-auto p-4">
          <AnalyticsDashboard tasks={tasks} worklogs={worklogs} />
          <div className="mt-4">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void handleRestore()}
            >
              Restore from Backup…
            </button>
          </div>
        </main>
      ) : view === "todos" ? (
        <main className="min-h-0 flex-1 overflow-auto p-4">
          <TodoListPanel
            todos={todos}
            onAdd={async (title) => {
              await createTodo(title);
              await refresh();
            }}
            onToggle={async (id, done) => {
              await updateTodo(id, { is_done: done });
              await refresh();
            }}
            onEdit={async (id, title) => {
              await updateTodo(id, { title });
              await refresh();
            }}
            onDelete={async (id) => {
              await deleteTodo(id);
              await refresh();
            }}
            onPromote={handlePromote}
          />
        </main>
      ) : (
        <main className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[1fr_320px]">
          <section className="min-h-0 space-y-3 overflow-auto">
            {showForm && (
              <TaskForm
                initial={editing}
                onSubmit={editing ? handleUpdate : handleCreate}
                onCancel={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              />
            )}

            {!ready ? (
              <p className="text-sm text-[var(--color-muted)]">Loading…</p>
            ) : (
              <TaskList
                tasks={tasks}
                activeTaskId={timer.taskId}
                onSelect={(t) => setSelectedId(t.id)}
                onStart={(t) => void timer.start(t.id, t.title)}
                onEdit={(t) => {
                  setEditing(t);
                  setShowForm(true);
                }}
                onDelete={(t) => void handleDelete(t)}
                onMarkDone={(t) => void handleMarkDone(t)}
              />
            )}
          </section>

          <aside className="surface min-h-0 space-y-3 overflow-auto rounded-xl p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Worklogs
                {selectedId != null && (
                  <button
                    type="button"
                    className="ml-2 text-xs font-normal text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                    onClick={() => setSelectedId(null)}
                  >
                    (show all)
                  </button>
                )}
              </h2>
              <span className="mono text-xs text-[var(--color-muted)]">
                {filteredWorklogs.length}
              </span>
            </div>
            <WorklogPanel
              worklogs={filteredWorklogs}
              onDelete={(id) =>
                void deleteWorklog(id).then(() => refresh())
              }
              onEdit={(w) => setEditingWorklog(w)}
            />
          </aside>
        </main>
      )}

      <IdleModal
        open={idle.showIdleModal}
        onClose={idle.dismiss}
        onSnooze={idle.snooze}
        onStart={(id, title) => {
          idle.dismiss();
          void timer.start(id, title);
        }}
      />

      {timer.pendingStop && (
        <SessionDescriptionModal
          session={timer.pendingStop}
          onConfirm={timer.confirmStop}
          onCancel={timer.cancelStop}
        />
      )}

      <LogPastWorkModal
        open={showLogPast}
        onClose={() => setShowLogPast(false)}
        onSave={async (input) => {
          await addWorklog(input);
          await refresh();
        }}
      />

      <EditWorklogModal
        worklog={editingWorklog}
        onClose={() => setEditingWorklog(null)}
        onSave={async (input) => {
          await updateWorklog(input.id, input);
          await refresh();
        }}
      />
    </div>
  );
}
