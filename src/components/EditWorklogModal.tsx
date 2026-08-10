import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { durationMinsBetween } from "../lib/time";
import type { Worklog } from "../types";

interface Props {
  worklog: Worklog | null;
  onClose: () => void;
  onSave: (input: {
    id: number;
    start_time: string;
    end_time: string;
    duration_mins: number;
    description: string;
  }) => Promise<void>;
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditWorklogModal({ worklog, onClose, onSave }: Props) {
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!worklog) return;
    setStartLocal(toLocalInputValue(worklog.start_time));
    setEndLocal(toLocalInputValue(worklog.end_time));
    setDescription(worklog.description ?? "");
    setError(null);
  }, [worklog]);

  if (!worklog) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!worklog) return;
    const current = worklog;
    setError(null);
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    const start = new Date(startLocal);
    const end = new Date(endLocal);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Invalid start or end time");
      return;
    }
    if (end <= start) {
      setError("End time must be after start time");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: current.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_mins: durationMinsBetween(
          start.toISOString(),
          end.toISOString(),
        ),
        description: description.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
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
          <h2 className="text-base font-semibold">Edit Worklog</h2>
          <button type="button" onClick={onClose} className="btn btn-icon">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="text-sm text-[var(--color-muted)]">
            {worklog.task_title ?? `Task #${worklog.task_id}`}
          </p>
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
          <label className="block text-xs text-[var(--color-muted)]">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
              className="mt-1 w-full rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary h-9">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary h-9">
              {saving ? "Saving…" : "Update"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
