import { useEffect, useState, type FormEvent } from "react";
import type { TaskStatus, TaskTag, TaskWithStats } from "../types";
import { TASK_TAGS, TAG_COLORS } from "../types";
import {
  ALLOWED_STORY_POINTS,
  formatDuration,
  isAllowedStoryPoint,
  storyPointsToMins,
} from "../lib/time";

interface Props {
  initial?: TaskWithStats | null;
  onSubmit: (values: {
    title: string;
    story_points: number;
    status: TaskStatus;
    is_high_priority: boolean;
    description: string | null;
    tag: TaskTag;
  }) => Promise<void>;
  onCancel: () => void;
}

function nearestAllowedSp(value: number): number {
  if (isAllowedStoryPoint(value)) return value;
  return ALLOWED_STORY_POINTS.reduce((best, sp) =>
    Math.abs(sp - value) < Math.abs(best - value) ? sp : best,
  );
}

export function TaskForm({ initial, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [sp, setSp] = useState(
    String(nearestAllowedSp(initial?.story_points ?? 1)),
  );
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? "todo");
  const [highPriority, setHighPriority] = useState(
    Boolean(initial?.is_high_priority),
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tag, setTag] = useState<TaskTag | "">(initial?.tag ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(initial?.title ?? "");
    setSp(String(nearestAllowedSp(initial?.story_points ?? 1)));
    setStatus(initial?.status ?? "todo");
    setHighPriority(Boolean(initial?.is_high_priority));
    setDescription(initial?.description ?? "");
    setTag(initial?.tag ?? "");
  }, [initial]);

  const spNum = Number(sp);
  const estimatePreview = isAllowedStoryPoint(spNum)
    ? formatDuration(storyPointsToMins(spNum))
    : "—";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!isAllowedStoryPoint(spNum)) {
      setError("Story points must be 0.5, 1, 2, 3, or 5");
      return;
    }
    if (!tag) {
      setError("A tag is required");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        story_points: spNum,
        status: initial ? status : "todo",
        is_high_priority: highPriority,
        description: description.trim() || null,
        tag,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="surface space-y-3 rounded-xl p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {initial ? "Edit task" : "New Task"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          Cancel
        </button>
      </div>

      <label className="block text-xs text-[var(--color-muted)]">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          placeholder="Implement auth middleware"
          autoFocus
        />
      </label>

      <label className="block text-xs text-[var(--color-muted)]">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional task notes…"
          className="mt-1 w-full resize-y rounded border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-[var(--color-muted)]">
          Story points
          <select
            value={sp}
            onChange={(e) => setSp(e.target.value)}
            className="mono mt-1 w-full rounded border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          >
            {ALLOWED_STORY_POINTS.map((value) => (
              <option key={value} value={value}>
                {value} SP
              </option>
            ))}
          </select>
        </label>
        <div className="text-xs text-[var(--color-muted)]">
          Estimate
          <div className="mono mt-1 rounded border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-sm text-[var(--color-accent)]">
            {estimatePreview}
          </div>
          <p className="mt-1 text-[10px]">1 SP = 1d = 8h</p>
        </div>
      </div>

      <div className="text-xs text-[var(--color-muted)]">
        Tag <span className="text-[var(--color-danger)]">*</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {TASK_TAGS.map((value) => {
            const on = tag === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTag(value)}
                className="rounded-md border px-2 py-1 text-[11px]"
                style={{
                  borderColor: on ? TAG_COLORS[value] : "var(--color-line)",
                  background: on ? `${TAG_COLORS[value]}22` : "transparent",
                  color: on ? TAG_COLORS[value] : "var(--color-muted)",
                }}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>

      {initial && (
        <label className="block text-xs text-[var(--color-muted)]">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className="mt-1 w-full rounded border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-sm text-[var(--color-text)]"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </label>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={highPriority}
          onChange={(e) => setHighPriority(e.target.checked)}
          className="accent-[var(--color-accent)]"
        />
        High priority
      </label>

      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="btn btn-primary h-10 w-full rounded-lg text-sm"
      >
        {saving ? "Saving…" : initial ? "Save Changes" : "Create Task"}
      </button>
    </form>
  );
}
