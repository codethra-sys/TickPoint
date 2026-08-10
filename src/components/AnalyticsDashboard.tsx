import { useMemo } from "react";
import type { TaskTag, TaskWithStats, Worklog } from "../types";
import { TASK_TAGS, TAG_COLORS, parseTags } from "../types";
import { formatDuration } from "../lib/time";

interface Props {
  tasks: TaskWithStats[];
  worklogs: Worklog[];
}

const TARGET_MINS = 8 * 60;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function AnalyticsDashboard({ tasks, worklogs }: Props) {
  const doneTasks = useMemo(
    () => tasks.filter((t) => t.status === "done" && t.original_estimate_mins > 0),
    [tasks],
  );

  const accuracy = useMemo(() => {
    if (doneTasks.length === 0) return null;
    const ratios = doneTasks.map(
      (t) => t.logged_mins / t.original_estimate_mins,
    );
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    return { avg, count: doneTasks.length, ratios };
  }, [doneTasks]);

  const todayMins = useMemo(() => {
    const start = startOfToday().getTime();
    return worklogs
      .filter((w) => new Date(w.start_time).getTime() >= start)
      .reduce((sum, w) => sum + w.duration_mins, 0);
  }, [worklogs]);

  const tagMins = useMemo(() => {
    const map = Object.fromEntries(TASK_TAGS.map((t) => [t, 0])) as Record<
      TaskTag,
      number
    >;
    for (const w of worklogs) {
      const tags = parseTags(w.task_tags);
      const tag = tags[0];
      if (!tag) continue;
      map[tag] += w.duration_mins;
    }
    return map;
  }, [worklogs]);

  const tagTotal = Object.values(tagMins).reduce((a, b) => a + b, 0);
  const capacityPct = Math.min(100, (todayMins / TARGET_MINS) * 100);

  return (
    <div className="space-y-4 overflow-auto">
      <div className="grid gap-4 md:grid-cols-2">
        <section className="surface rounded-xl p-4">
          <h3 className="text-sm font-semibold">Estimation Accuracy</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Logged ÷ original estimate across completed tasks
          </p>
          {accuracy == null ? (
            <p className="mt-6 text-sm text-[var(--color-muted)]">
              Complete tasks with estimates to see accuracy.
            </p>
          ) : (
            <div className="mt-4">
              <p className="mono text-3xl font-semibold text-[var(--color-accent)]">
                {accuracy.avg.toFixed(2)}×
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Average ratio · {accuracy.count} completed task
                {accuracy.count === 1 ? "" : "s"}
              </p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                {accuracy.avg < 0.9
                  ? "Estimates tend to be high (finishing early)."
                  : accuracy.avg > 1.1
                    ? "Estimates tend to be low (overrunning)."
                    : "Estimates are well calibrated."}
              </p>
              <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-xs">
                {doneTasks.map((t) => {
                  const ratio = t.logged_mins / t.original_estimate_mins;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-2 border-t border-[var(--color-line)]/60 py-1"
                    >
                      <span className="truncate">{t.title}</span>
                      <span className="mono shrink-0 text-[var(--color-muted)]">
                        {ratio.toFixed(2)}×
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        <section className="surface rounded-xl p-4">
          <h3 className="text-sm font-semibold">Daily Capacity</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Hours logged today vs 8h target
          </p>
          <p className="mono mt-4 text-2xl font-semibold">
            {(todayMins / 60).toFixed(1)}
            <span className="text-base text-[var(--color-muted)]"> / 8 hrs</span>
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--color-panel-2)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all"
              style={{ width: `${capacityPct}%` }}
            />
          </div>
          <p className="mono mt-2 text-xs text-[var(--color-muted)]">
            {formatDuration(todayMins)} logged today
          </p>
        </section>
      </div>

      <section className="surface rounded-xl p-4">
        <h3 className="text-sm font-semibold">Category / Tag Distribution</h3>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Time attributed by each task&apos;s tag
        </p>
        {tagTotal === 0 ? (
          <p className="mt-6 text-sm text-[var(--color-muted)]">
            Tag your tasks and log work to see distribution.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex h-4 overflow-hidden rounded-full">
              {TASK_TAGS.map((tag) => {
                const mins = tagMins[tag];
                if (mins <= 0) return null;
                return (
                  <div
                    key={tag}
                    title={`${tag}: ${formatDuration(Math.round(mins))}`}
                    style={{
                      width: `${(mins / tagTotal) * 100}%`,
                      background: TAG_COLORS[tag],
                    }}
                  />
                );
              })}
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TASK_TAGS.map((tag) => {
                const mins = tagMins[tag];
                const pct = tagTotal ? (mins / tagTotal) * 100 : 0;
                return (
                  <li
                    key={tag}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: TAG_COLORS[tag] }}
                      />
                      {tag}
                    </span>
                    <span className="mono text-xs text-[var(--color-muted)]">
                      {formatDuration(Math.round(mins))} · {pct.toFixed(0)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
