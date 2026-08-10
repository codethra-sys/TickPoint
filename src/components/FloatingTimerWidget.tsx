import { useEffect, useRef, useState } from "react";
import {
  LogicalPosition,
  LogicalSize,
  currentMonitor,
  getCurrentWindow,
} from "@tauri-apps/api/window";
import { Pause, Play, Square } from "lucide-react";
import { formatTimerClock } from "../lib/time";
import { broadcastRequestStop, useTimer } from "../hooks/useTimer";

const COLLAPSED = { w: 48, h: 48 };
const EXPANDED = { w: 300, h: 136 };
const MARGIN = 24;

export function FloatingTimerWidget() {
  const timer = useTimer();
  const [expanded, setExpanded] = useState(false);
  const visible = timer.phase === "running" || timer.phase === "paused";
  const rightEdgeRef = useRef<number | null>(null);
  const topRef = useRef<number>(MARGIN + 48);

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    const root = document.getElementById("root");
    if (root) {
      root.style.background = "transparent";
      root.style.height = "100%";
      root.style.width = "100%";
    }
  }, []);

  useEffect(() => {
    void getCurrentWindow().setAlwaysOnTop(true);
  }, []);

  useEffect(() => {
    const win = getCurrentWindow();

    void (async () => {
      if (!visible) {
        setExpanded(false);
        await win.hide();
        return;
      }

      const size = expanded ? EXPANDED : COLLAPSED;
      await win.setSize(new LogicalSize(size.w, size.h));

      const monitor = await currentMonitor();
      if (monitor) {
        const logical = monitor.size.toLogical(monitor.scaleFactor);
        if (rightEdgeRef.current == null) {
          rightEdgeRef.current = logical.width - MARGIN;
          topRef.current = MARGIN + 48;
        }
        // Keep the right edge anchored so expansion opens to the left.
        const x = rightEdgeRef.current - size.w;
        await win.setPosition(new LogicalPosition(x, topRef.current));
      }

      await win.show();
    })();
  }, [visible, expanded]);

  if (!visible) {
    return <div className="h-full w-full bg-transparent" />;
  }

  return (
    <div
      className="box-border h-full w-full overflow-hidden bg-[var(--color-panel)] text-[var(--color-text)] shadow-lg ring-1 ring-[var(--color-line)]"
      style={{ borderRadius: 12 }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        void (async () => {
          await getCurrentWindow().startDragging();
          try {
            const win = getCurrentWindow();
            const pos = await win.outerPosition();
            const size = await win.outerSize();
            const scale = (await win.scaleFactor()) || 1;
            rightEdgeRef.current = pos.x / scale + size.width / scale;
            topRef.current = pos.y / scale;
          } catch {
            /* ignore */
          }
        })();
      }}
    >
      {!expanded ? (
        <div className="flex h-full w-full items-center justify-center bg-[var(--color-panel)]">
          <span
            className={`h-3.5 w-3.5 rounded-md ${
              timer.phase === "paused"
                ? "bg-[var(--color-amber)]"
                : "bg-[var(--color-accent)] animate-pulse"
            }`}
          />
        </div>
      ) : (
        <div className="flex h-full flex-col gap-2 bg-[var(--color-panel)] p-3">
          <p className="truncate text-xs font-medium text-[var(--color-muted)]">
            {timer.taskTitle ?? "Task"}
          </p>
          <p className="mono text-xl font-semibold leading-none text-[var(--color-accent)]">
            {formatTimerClock(timer.elapsedMs)}
          </p>
          <div className="mt-auto flex gap-2">
            {timer.phase === "running" ? (
              <button
                type="button"
                onClick={() => void timer.pause()}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-[#3a2e18] px-2 py-1.5 text-xs text-[var(--color-amber)]"
              >
                <Pause size={12} /> Pause
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void timer.resume()}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-[var(--color-accent-dim)] px-2 py-1.5 text-xs text-white"
              >
                <Play size={12} /> Resume
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                broadcastRequestStop();
                void getCurrentWindow().hide();
              }}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-[#3a1f28] px-2 py-1.5 text-xs text-[var(--color-danger)]"
            >
              <Square size={12} /> Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
