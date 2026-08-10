import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { TaskWithStats, Worklog } from "../types";
import { formatDuration, formatRemaining } from "./time";

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

function formatWeekLabel(start: Date, endExclusive: Date): string {
  const end = new Date(endExclusive.getTime() - 1);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function safeFilename(label: string): string {
  return `tickpoint-weekly-${label.replace(/[^\w.-]+/g, "-")}.pdf`;
}

/** Export a Monday–Sunday weekly summary for the week containing `anchor` (default: today). */
export async function exportWeeklyReportPdf(
  tasks: TaskWithStats[],
  worklogs: Worklog[],
  anchor: Date = new Date(),
): Promise<void> {
  const weekStart = startOfWeek(anchor);
  const weekEnd = endOfWeek(anchor);
  const weekLabel = formatWeekLabel(weekStart, weekEnd);

  const weekLogs = worklogs.filter((w) => {
    const t = new Date(w.start_time).getTime();
    return t >= weekStart.getTime() && t < weekEnd.getTime();
  });

  const loggedByTask = new Map<number, number>();
  for (const w of weekLogs) {
    loggedByTask.set(
      w.task_id,
      (loggedByTask.get(w.task_id) ?? 0) + w.duration_mins,
    );
  }

  const weekTasks = tasks
    .filter((t) => loggedByTask.has(t.id))
    .map((t) => ({
      ...t,
      week_logged_mins: loggedByTask.get(t.id) ?? 0,
    }));

  const totalWeekMins = weekLogs.reduce((s, w) => s + w.duration_mins, 0);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.text("TickPoint Weekly Summary", 14, 18);
  doc.setFontSize(11);
  doc.text(weekLabel, 14, 26);
  doc.setFontSize(10);
  doc.text(`Total logged: ${formatDuration(totalWeekMins)}`, 14, 32);

  autoTable(doc, {
    startY: 38,
    head: [["Task", "Tag", "SP", "Week Logged", "Est. Remaining", "Status"]],
    body:
      weekTasks.length === 0
        ? [["—", "—", "—", "—", "—", "—"]]
        : weekTasks.map((t) => {
            const rem = formatRemaining(t.remaining_mins);
            return [
              t.title,
              t.tag ?? "—",
              String(t.story_points),
              formatDuration(t.week_logged_mins),
              rem.isOver ? `-${rem.label}` : rem.label,
              t.status,
            ];
          }),
    styles: { fontSize: 9, font: "helvetica" },
    headStyles: { fillColor: [15, 76, 92] },
  });

  const afterTasks =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 46;

  doc.setFontSize(13);
  doc.text("Worklogs this week", 14, afterTasks + 12);

  autoTable(doc, {
    startY: afterTasks + 16,
    head: [["Task", "Start", "End", "Duration", "Note"]],
    body:
      weekLogs.length === 0
        ? [["—", "—", "—", "—", "—"]]
        : weekLogs.map((w) => [
            w.task_title ?? String(w.task_id),
            new Date(w.start_time).toLocaleString(),
            new Date(w.end_time).toLocaleString(),
            formatDuration(w.duration_mins),
            w.description ?? "",
          ]),
    styles: { fontSize: 8, font: "helvetica" },
    headStyles: { fillColor: [15, 76, 92] },
  });

  const bytes = Array.from(new Uint8Array(doc.output("arraybuffer")));
  const path = await save({
    defaultPath: safeFilename(weekLabel),
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (!path) return;
  await invoke("save_file", { path, contents: bytes });
}
