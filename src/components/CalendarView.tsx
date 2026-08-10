import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TaskWithStats, Worklog } from "../types";
import { formatDuration } from "../lib/time";

type Mode = "week" | "month";

/** Full day: 00:00 through next-day 00:00 (24 hour slots). */
const DAY_START_HOUR = 0;
const DAY_HOURS = 24;
const HEADER_H = 52;
const TIME_GUTTER = 56;

interface Props {
  worklogs: Worklog[];
  tasks: TaskWithStats[];
}

interface TimedBlock {
  worklog: Worklog;
  startMin: number;
  endMin: number;
  col: number;
  colCount: number;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Pack overlapping intervals into side-by-side columns (calendar-style). */
function layoutDayBlocks(
  dayLogs: Worklog[],
  hourStart: number,
): TimedBlock[] {
  const items = dayLogs
    .map((worklog) => {
      const start = new Date(worklog.start_time);
      const end = new Date(worklog.end_time);
      const startMin = Math.max(
        0,
        start.getHours() * 60 + start.getMinutes() - hourStart * 60,
      );
      const rawEnd =
        end.getHours() * 60 + end.getMinutes() - hourStart * 60;
      const endMin = Math.min(
        DAY_HOURS * 60,
        Math.max(rawEnd, startMin + 15),
      );
      return { worklog, startMin, endMin };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  if (items.length === 0) return [];

  // Connected clusters of overlapping events
  const clusters: (typeof items)[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -1;

  for (const item of items) {
    if (cluster.length === 0 || item.startMin < clusterEnd) {
      cluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      clusters.push(cluster);
      cluster = [item];
      clusterEnd = item.endMin;
    }
  }
  if (cluster.length) clusters.push(cluster);

  const result: TimedBlock[] = [];

  for (const group of clusters) {
    const colEnds: number[] = [];
    const placed: { item: (typeof items)[number]; col: number }[] = [];

    for (const item of group) {
      let col = colEnds.findIndex((end) => end <= item.startMin);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(item.endMin);
      } else {
        colEnds[col] = item.endMin;
      }
      placed.push({ item, col });
    }

    const colCount = Math.max(1, colEnds.length);
    for (const { item, col } of placed) {
      result.push({
        worklog: item.worklog,
        startMin: item.startMin,
        endMin: item.endMin,
        col,
        colCount,
      });
    }
  }

  return result;
}

export function CalendarView({ worklogs, tasks }: Props) {
  const [mode, setMode] = useState<Mode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    worklog: Worklog;
    task?: TaskWithStats;
  } | null>(null);
  /** Non-scrolling shell — measuring this avoids scrollbar feedback loops. */
  const shellRef = useRef<HTMLDivElement>(null);
  const lastSize = useRef({ w: 0, h: 0 });
  const [viewport, setViewport] = useState({ w: 800, h: 520 });

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    const update = () => {
      const w = Math.floor(el.clientWidth);
      const h = Math.floor(el.clientHeight);
      // Ignore sub-scrollbar jitter (~15px) that causes flicker.
      if (
        lastSize.current.w > 0 &&
        Math.abs(w - lastSize.current.w) < 20 &&
        Math.abs(h - lastSize.current.h) < 20
      ) {
        return;
      }
      lastSize.current = { w, h };
      setViewport({ w, h });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const days = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const start = startOfMonth(anchor);
    const count = new Date(
      anchor.getFullYear(),
      anchor.getMonth() + 1,
      0,
    ).getDate();
    return Array.from({ length: count }, (_, i) => addDays(start, i));
  }, [anchor, mode]);

  const hourStart = DAY_START_HOUR;
  const hours = Array.from({ length: DAY_HOURS }, (_, i) => hourStart + i);

  // Fit exactly to shell height so vertical scrollbar is not needed.
  const bodyH = Math.max(200, viewport.h - HEADER_H);
  const pxPerHour = bodyH / DAY_HOURS;
  const gridHeight = DAY_HOURS * pxPerHour;

  const label = useMemo(() => {
    if (mode === "week") {
      const a = days[0];
      const b = days[days.length - 1];
      return `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${b.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return anchor.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [anchor, days, mode]);

  function shift(dir: -1 | 1) {
    setAnchor((prev) => {
      const next = new Date(prev);
      if (mode === "week") next.setDate(next.getDate() + dir * 7);
      else next.setMonth(next.getMonth() + dir);
      return next;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="btn btn-icon"
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="btn btn-ghost"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="btn btn-icon"
            aria-label="Next"
          >
            <ChevronRight size={16} />
          </button>
          <h2 className="text-sm font-semibold tracking-tight">{label}</h2>
        </div>
        <div className="flex h-8 items-center rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-0.5 text-xs">
          {(["week", "month"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`h-7 rounded-md px-3 capitalize ${
                mode === m
                  ? "bg-[var(--color-accent)] font-semibold text-[#062a28] shadow-sm"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-panel-2)] hover:text-[var(--color-text)]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={shellRef}
        className="surface-inset min-h-0 flex-1 overflow-hidden rounded-xl"
      >
        <div
          className="h-full w-full overflow-x-auto overflow-y-hidden"
          style={{ scrollbarGutter: "stable" }}
        >
          <div
            className="grid h-full"
            style={{
              width: "100%",
              minWidth:
                mode === "month"
                  ? TIME_GUTTER + days.length * 56
                  : undefined,
              gridTemplateColumns: `${TIME_GUTTER}px repeat(${days.length}, minmax(0, 1fr))`,
            }}
          >
          <div
            className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-[var(--color-panel)]/95 backdrop-blur"
            style={{ height: HEADER_H }}
          />
          {days.map((d) => (
            <div
              key={d.toISOString()}
              className="sticky top-0 z-10 flex flex-col items-center justify-center border-b border-l border-[var(--color-line)] bg-[var(--color-panel)]/95 px-1 backdrop-blur"
              style={{ height: HEADER_H }}
            >
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className="mt-1 text-sm font-semibold leading-none">
                {d.getDate()}
              </div>
            </div>
          ))}

          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((h, i) => (
              <div
                key={h}
                className="mono absolute inset-x-0 flex items-center justify-center text-[10px] text-[var(--color-muted)]"
                style={{ top: i * pxPerHour, height: pxPerHour }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
            <div
              className="mono absolute inset-x-0 -bottom-0 flex h-0 items-center justify-center text-[10px] text-[var(--color-muted)]"
              style={{ top: gridHeight - 1 }}
              title="Next day"
            >
              <span className="translate-y-1/2 bg-[var(--color-panel)] px-1">
                00:00
              </span>
            </div>
          </div>

          {days.map((day) => {
            const dayLogs = worklogs.filter((w) =>
              sameDay(new Date(w.start_time), day),
            );
            const blocks = layoutDayBlocks(dayLogs, hourStart);

            return (
              <div
                key={`col-${day.toISOString()}`}
                className="relative border-l border-[var(--color-line)]"
                style={{ height: gridHeight }}
              >
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-[var(--color-line)]/45"
                    style={{ top: i * pxPerHour, height: pxPerHour }}
                  />
                ))}
                <div
                  className="absolute inset-x-0 border-t border-[var(--color-line)]/70"
                  style={{ top: gridHeight }}
                />

                {blocks.map((block) => {
                  const top = (block.startMin / 60) * pxPerHour;
                  const height = Math.max(
                    22,
                    ((block.endMin - block.startMin) / 60) * pxPerHour,
                  );
                  const widthPct = 100 / block.colCount;
                  const leftPct = widthPct * block.col;
                  const task = tasks.find((t) => t.id === block.worklog.task_id);
                  const title =
                    block.worklog.task_title ??
                    task?.title ??
                    `Task #${block.worklog.task_id}`;

                  return (
                    <button
                      key={block.worklog.id}
                      type="button"
                      className="absolute z-[1] flex flex-col items-center justify-center overflow-hidden rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-accent-dim)] px-1 text-center text-white shadow-sm hover:z-[2] hover:border-[var(--color-accent)]/70 hover:bg-[#1f8f86]"
                      style={{
                        top,
                        height,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                      onMouseEnter={(e) =>
                        setTooltip({
                          x: e.clientX,
                          y: e.clientY,
                          worklog: block.worklog,
                          task,
                        })
                      }
                      onMouseMove={(e) =>
                        setTooltip({
                          x: e.clientX,
                          y: e.clientY,
                          worklog: block.worklog,
                          task,
                        })
                      }
                      onMouseLeave={() => setTooltip(null)}
                      onClick={(e) =>
                        setTooltip({
                          x: e.clientX,
                          y: e.clientY,
                          worklog: block.worklog,
                          task,
                        })
                      }
                    >
                      <span className="w-full truncate text-[10px] font-medium leading-tight">
                        {title}
                      </span>
                      {height >= 34 && (
                        <span className="mono mt-0.5 text-[9px] leading-none opacity-90">
                          {formatDuration(block.worklog.duration_mins)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-xs shadow-xl"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <p className="font-semibold">
            {tooltip.worklog.task_title ??
              tooltip.task?.title ??
              `Task #${tooltip.worklog.task_id}`}
          </p>
          <p className="mono mt-1 text-[var(--color-muted)]">
            {new Date(tooltip.worklog.start_time).toLocaleString()} →{" "}
            {new Date(tooltip.worklog.end_time).toLocaleTimeString()}
          </p>
          <p className="mono text-[var(--color-accent)]">
            {formatDuration(tooltip.worklog.duration_mins)}
            {tooltip.task ? ` · ${tooltip.task.story_points} SP` : ""}
          </p>
          {tooltip.task && (
            <p className="mt-1 text-[var(--color-muted)]">
              Status: {tooltip.task.status}
              {Number(tooltip.task.is_high_priority) ? " · High priority" : ""}
            </p>
          )}
          <p className="mt-2 text-[var(--color-text)]">
            {tooltip.worklog.description?.trim() || "No description"}
          </p>
        </div>
      )}
    </div>
  );
}
