import {
  CheckCircle2,
  Pencil,
  Play,
  Star,
  Trash2,
} from "lucide-react";
import type { TaskWithStats } from "../types";
import { TAG_COLORS } from "../types";
import { formatDuration, formatRemaining } from "../lib/time";
import { OvertimeBadge, StatusBadge } from "./StatusBadge";

interface Props {
  tasks: TaskWithStats[];
  activeTaskId: number | null;
  onSelect: (task: TaskWithStats) => void;
  onStart: (task: TaskWithStats) => void;
  onEdit: (task: TaskWithStats) => void;
  onDelete: (task: TaskWithStats) => void;
  onMarkDone: (task: TaskWithStats) => void;
}

export function TaskList({
  tasks,
  activeTaskId,
  onSelect,
  onStart,
  onEdit,
  onDelete,
  onMarkDone,
}: Props) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-line)] px-4 py-10 text-center text-sm text-[var(--color-muted)]">
        No tasks yet. Create one to start logging time.
      </div>
    );
  }

  return (
    <div className="surface overflow-hidden rounded-xl">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-[var(--color-panel-2)]/80 text-xs uppercase tracking-wide text-[var(--color-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">Task</th>
            <th className="px-3 py-2 font-medium">SP</th>
            <th className="px-3 py-2 font-medium">Logged</th>
            <th className="px-3 py-2 font-medium">Remaining</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const rem = formatRemaining(task.remaining_mins);
            const active = activeTaskId === task.id;
            return (
              <tr
                key={task.id}
                onClick={() => onSelect(task)}
                className={`cursor-pointer border-t border-[var(--color-line)] transition-colors hover:bg-[var(--color-panel-2)]/70 ${
                  active ? "bg-[var(--color-panel-2)]" : "bg-transparent"
                }`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {Number(task.is_high_priority) === 1 && (
                      <Star
                        size={13}
                        className="shrink-0 fill-[var(--color-amber)] text-[var(--color-amber)]"
                      />
                    )}
                    <span className="font-medium">{task.title}</span>
                  </div>
                  <div className="mono mt-0.5 text-[11px] text-[var(--color-muted)]">
                    Est {formatDuration(task.original_estimate_mins)}
                  </div>
                  {task.description && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--color-muted)]">
                      {task.description}
                    </p>
                  )}
                  {task.tag && (
                    <div className="mt-1">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px]"
                        style={{
                          background: `${TAG_COLORS[task.tag]}22`,
                          color: TAG_COLORS[task.tag],
                        }}
                      >
                        {task.tag}
                      </span>
                    </div>
                  )}
                </td>
                <td className="mono px-3 py-2.5 text-[var(--color-muted)]">
                  {task.story_points}
                </td>
                <td className="mono px-3 py-2.5">
                  {formatDuration(task.logged_mins)}
                </td>
                <td className="px-3 py-2.5">
                  {rem.isOver ? (
                    <OvertimeBadge label={rem.label} />
                  ) : (
                    <span className="mono text-[var(--color-muted)]">
                      {rem.label}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-3 py-2.5">
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {task.status !== "done" && (
                      <button
                        type="button"
                        title="Start timer"
                        onClick={() => onStart(task)}
                        className="rounded-md p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15"
                      >
                        <Play size={14} />
                      </button>
                    )}
                    {task.status !== "done" && (
                      <button
                        type="button"
                        title="Mark done"
                        onClick={() => onMarkDone(task)}
                        className="rounded-md p-1.5 text-[var(--color-ok)] hover:bg-[var(--color-ok)]/15"
                      >
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => onEdit(task)}
                      className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-panel-2)] hover:text-[var(--color-text)]"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => onDelete(task)}
                      className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
