import { AlertTriangle, Pause } from "lucide-react";

export function StatusBadge({
  status,
}: {
  status: "todo" | "in_progress" | "done";
}) {
  const styles = {
    todo: "bg-[#243044] text-[#9eb3c7]",
    in_progress: "bg-[#1a3d45] text-[#5fd0c5]",
    done: "bg-[#1d3a2c] text-[#6fd49a]",
  } as const;

  const labels = {
    todo: "To Do",
    in_progress: "In Progress",
    done: "Done",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export function OvertimeBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-[#3a1f28] px-2 py-0.5 text-xs font-medium text-[var(--color-danger)]">
      <AlertTriangle size={12} />
      -{label}
    </span>
  );
}

export function PausedBadge({ title }: { title: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded bg-[#3a2e18] px-2.5 py-1 text-xs font-medium text-[var(--color-amber)]">
      <Pause size={12} className="shrink-0" />
      <span className="truncate">Task Paused: {title} - Resume Needed</span>
    </span>
  );
}
