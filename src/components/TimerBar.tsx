import { Pause, Play, Square } from "lucide-react";
import { formatTimerClock } from "../lib/time";
import type { TimerSnapshot } from "../types";
import { PausedBadge } from "./StatusBadge";

interface Props {
  snapshot: TimerSnapshot;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function TimerBar({ snapshot, onPause, onResume, onStop }: Props) {
  const { phase, taskTitle, elapsedMs } = snapshot;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-panel)]/70 px-4 py-3 backdrop-blur-md">
      <div className="mono text-2xl font-semibold tracking-tight text-[var(--color-accent)]">
        {formatTimerClock(elapsedMs)}
      </div>

      <div className="min-w-0 flex-1">
        {phase === "idle" ? (
          <p className="text-sm text-[var(--color-muted)]">
            No active timer — select a task to start tracking
          </p>
        ) : phase === "paused" && taskTitle ? (
          <PausedBadge title={taskTitle} />
        ) : (
          <p className="truncate text-sm font-medium">
            Tracking:{" "}
            <span className="text-[var(--color-accent)]">{taskTitle}</span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {phase === "running" && (
          <button
            type="button"
            onClick={onPause}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#3a2e18] px-3 text-sm text-[var(--color-amber)] hover:bg-[#4a3a1c]"
          >
            <Pause size={14} /> Pause
          </button>
        )}
        {phase === "paused" && (
          <button
            type="button"
            onClick={onResume}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-accent-dim)] px-3 text-sm text-white hover:bg-[#21968d]"
          >
            <Play size={14} /> Resume
          </button>
        )}
        {phase !== "idle" && (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#3a1f28] px-3 text-sm text-[var(--color-danger)] hover:bg-[#4a2833]"
          >
            <Square size={14} /> Stop
          </button>
        )}
      </div>
    </div>
  );
}
