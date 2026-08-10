import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { selectableTasks } from "../lib/db";
import { durationMinsBetween } from "../lib/time";
import type { TaskWithStats } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (input: {
    task_id: number;
    start_time: string;
    end_time: string;
    duration_mins: number;
    description: string;
  }) => Promise<void>;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LogPastWorkModal({ open, onClose, onSave }: Props) {
  const [tasks, setTasks] = useState<TaskWithStats[]>([]);
  const [taskId, setTaskId] = useState<number | "">("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [durationMins, setDurationMins] = useState("");
  const [mode, setMode] = useState<"range" | "duration">("range");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000);
    setStartLocal(toLocalInputValue(start));
    setEndLocal(toLocalInputValue(now));
    setDurationMins("60");
    setDescription("");
    setError(null);
    setMode("range");
    void selectableTasks().then((list) => {
      setTasks(list);
      setTaskId(list[0]?.id ?? "");
    });
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!taskId) {
      setError("Select a task");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    let start: Date;
    let end: Date;
    let mins: number;

    if (mode === "duration") {
      mins = Number(durationMins);
      if (!Number.isFinite(mins) || mins < 1) {
        setError("Duration must be at least 1 minute");
        return;
      }
      end = new Date(startLocal);
      if (Number.isNaN(end.getTime())) {
        setError("Invalid end/base time");
        return;
      }
      // Treat startLocal as the start when using duration
      start = new Date(startLocal);
      end = new Date(start.getTime() + mins * 60_000);
    } else {
      start = new Date(startLocal);
      end = new Date(endLocal);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        setError("Invalid start or end time");
        return;
      }
      if (end <= start) {
        setError("End time must be after start time");
        return;
      }
      mins = durationMinsBetween(start.toISOString(), end.toISOString());
    }

    setSaving(true);
    try {
      await onSave({
        task_id: Number(taskId),
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_mins: mins,
        description: description.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
          <h2 className="text-base font-semibold">Log Past Work</h2>
          <button type="button" onClick={onClose} className="btn btn-icon">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <label className="block text-xs text-[var(--color-muted)]">
            Task
            <select
              value={taskId}
              onChange={(e) =>
                setTaskId(e.target.value ? Number(e.target.value) : "")
              }
              className="mt-1 w-full rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3 py-2 text-sm"
            >
              {tasks.length === 0 && <option value="">No open tasks</option>}
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {Number(t.is_high_priority) ? "★ " : ""}
                  {t.title}
                </option>
              ))}
            </select>
          </label>

          <div className="flex h-8 w-fit items-center rounded-lg border border-[var(--color-line)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMode("range")}
              className={`h-7 rounded-md px-3 ${mode === "range" ? "bg-[var(--color-accent)] font-semibold text-[#062a28]" : "text-[var(--color-muted)]"}`}
            >
              Start / End
            </button>
            <button
              type="button"
              onClick={() => setMode("duration")}
              className={`h-7 rounded-md px-3 ${mode === "duration" ? "bg-[var(--color-accent)] font-semibold text-[#062a28]" : "text-[var(--color-muted)]"}`}
            >
              Duration
            </button>
          </div>

          {mode === "range" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-[var(--color-muted)]">
                Start
                <input
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  className="mono mt-1 w-full rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] px-2 py-2 text-sm"
                />
              </label>
              <label className="block text-xs text-[var(--color-muted)]">
                End
                <input
                  type="datetime-local"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                  className="mono mt-1 w-full rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] px-2 py-2 text-sm"
                />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-[var(--color-muted)]">
                Start
                <input
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  className="mono mt-1 w-full rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] px-2 py-2 text-sm"
                />
              </label>
              <label className="block text-xs text-[var(--color-muted)]">
                Duration (mins)
                <input
                  type="number"
                  min={1}
                  value={durationMins}
                  onChange={(e) => setDurationMins(e.target.value)}
                  className="mono mt-1 w-full rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] px-2 py-2 text-sm"
                />
              </label>
            </div>
          )}

          <label className="block text-xs text-[var(--color-muted)]">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
              placeholder="What did you accomplish?"
              className="mt-1 w-full rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3 py-2 text-sm"
            />
          </label>

          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary h-9">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary h-9"
            >
              {saving ? "Saving…" : "Save Worklog"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
