import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { selectableTasks } from "../lib/db";
import type { TaskWithStats } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSnooze: () => void;
  onStart: (taskId: number, title: string) => void;
}

export function IdleModal({ open, onClose, onSnooze, onStart }: Props) {
  const [tasks, setTasks] = useState<TaskWithStats[]>([]);
  const [selectedId, setSelectedId] = useState<number | "">("");

  useEffect(() => {
    if (!open) return;
    void selectableTasks().then((list) => {
      setTasks(list);
      setSelectedId(list[0]?.id ?? "");
    });
  }, [open]);

  if (!open) return null;

  const selected = tasks.find((t) => t.id === selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-md rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
          <h2 className="text-base font-semibold">What are you working on?</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-panel-2)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <p className="text-sm text-[var(--color-muted)]">
            No timer is running. Pick a task to start tracking, or snooze for 15
            minutes.
          </p>

          <label className="block text-xs font-medium text-[var(--color-muted)]">
            Task
            <select
              className="mt-1 w-full rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3 py-2 text-sm text-[var(--color-text)]"
              value={selectedId}
              onChange={(e) =>
                setSelectedId(e.target.value ? Number(e.target.value) : "")
              }
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

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onSnooze}
              className="btn btn-secondary h-9"
            >
              Snooze (15m)
            </button>
            <button
              type="button"
              disabled={!selected}
              onClick={() => selected && onStart(selected.id, selected.title)}
              className="btn btn-primary h-9 disabled:opacity-40"
            >
              Start Timer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
