import { Pencil, Trash2 } from "lucide-react";
import type { Worklog } from "../types";
import { formatDuration } from "../lib/time";

interface Props {
  worklogs: Worklog[];
  onDelete: (id: number) => void;
  onEdit: (worklog: Worklog) => void;
}

export function WorklogPanel({ worklogs, onDelete, onEdit }: Props) {
  if (worklogs.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">No worklogs yet.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {worklogs.map((w) => (
        <li
          key={w.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]/50 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {w.task_title ?? `Task #${w.task_id}`}
            </p>
            <p className="mono text-[11px] text-[var(--color-muted)]">
              {new Date(w.start_time).toLocaleString()} →{" "}
              {new Date(w.end_time).toLocaleTimeString()} ·{" "}
              {formatDuration(w.duration_mins)}
            </p>
            {w.description && (
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                {w.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-0.5">
            <button
              type="button"
              onClick={() => onEdit(w)}
              className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-text)]"
              title="Edit worklog"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(w.id)}
              className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-danger)]"
              title="Delete worklog"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
