import { useCallback, useEffect, useRef, useState } from "react";
import { addWorklog, ensureInProgress, getTask } from "../lib/db";
import { nowIso } from "../lib/time";
import type { PendingStopSession, TimerPhase, TimerSnapshot } from "../types";

const STORAGE_KEY = "tickpoint.timer";
const CHANNEL = "tickpoint-timer";
const SLEEP_GAP_MS = 60_000;

interface PersistedTimer {
  phase: TimerPhase;
  taskId: number | null;
  taskTitle: string | null;
  startedAt: string | null;
  sessionStartedAt: string | null;
  accumulatedMs: number;
}

function loadPersisted(): PersistedTimer {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        phase: "idle",
        taskId: null,
        taskTitle: null,
        startedAt: null,
        sessionStartedAt: null,
        accumulatedMs: 0,
      };
    }
    return JSON.parse(raw) as PersistedTimer;
  } catch {
    return {
      phase: "idle",
      taskId: null,
      taskTitle: null,
      startedAt: null,
      sessionStartedAt: null,
      accumulatedMs: 0,
    };
  }
}

function savePersisted(state: PersistedTimer): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage({ type: "sync", state });
    bc.close();
  } catch {
    /* ignore */
  }
}

function computeElapsedMs(s: PersistedTimer, now = Date.now()): number {
  if (s.phase === "running" && s.startedAt) {
    return s.accumulatedMs + (now - new Date(s.startedAt).getTime());
  }
  if (s.phase === "paused") return s.accumulatedMs;
  return 0;
}

export function useTimer(onChanged?: () => void) {
  const initial = loadPersisted();
  const [phase, setPhase] = useState<TimerPhase>(initial.phase);
  const [taskId, setTaskId] = useState<number | null>(initial.taskId);
  const [taskTitle, setTaskTitle] = useState<string | null>(initial.taskTitle);
  const [startedAt, setStartedAt] = useState<string | null>(initial.startedAt);
  const [, setAccumulatedMs] = useState(initial.accumulatedMs);
  const [elapsedMs, setElapsedMs] = useState(() => computeElapsedMs(initial));
  const [pendingStop, setPendingStop] = useState<PendingStopSession | null>(
    null,
  );
  const lastTickRef = useRef(Date.now());
  const stateRef = useRef({
    phase: initial.phase,
    taskId: initial.taskId,
    taskTitle: initial.taskTitle,
    startedAt: initial.startedAt,
    sessionStartedAt: initial.sessionStartedAt,
    accumulatedMs: initial.accumulatedMs,
  });
  const pendingStartRef = useRef<{ id: number; title: string } | null>(null);

  const persist = useCallback(() => {
    const s = stateRef.current;
    savePersisted({
      phase: s.phase,
      taskId: s.taskId,
      taskTitle: s.taskTitle,
      startedAt: s.startedAt,
      sessionStartedAt: s.sessionStartedAt,
      accumulatedMs: s.accumulatedMs,
    });
  }, []);

  const syncRef = useCallback(
    (next: Partial<typeof stateRef.current>) => {
      stateRef.current = { ...stateRef.current, ...next };
      if (next.phase !== undefined) setPhase(next.phase);
      if (next.taskId !== undefined) setTaskId(next.taskId);
      if (next.taskTitle !== undefined) setTaskTitle(next.taskTitle);
      if (next.startedAt !== undefined) setStartedAt(next.startedAt);
      if (next.accumulatedMs !== undefined)
        setAccumulatedMs(next.accumulatedMs);
      persist();
    },
    [persist],
  );

  const pauseInternal = useCallback(
    async (reason: "manual" | "sleep") => {
      void reason;
      const s = stateRef.current;
      if (s.phase !== "running" || s.taskId == null || !s.startedAt) return;

      const end = nowIso();
      const segmentMs =
        new Date(end).getTime() - new Date(s.startedAt).getTime();
      syncRef({
        phase: "paused",
        startedAt: null,
        accumulatedMs: s.accumulatedMs + segmentMs,
      });
      setElapsedMs(s.accumulatedMs + segmentMs);
    },
    [syncRef],
  );

  const start = useCallback(
    async (id: number, title: string): Promise<"ok" | "needs_stop"> => {
      const s = stateRef.current;
      if (pendingStop) return "needs_stop";

      if (
        (s.phase === "running" || s.phase === "paused") &&
        s.taskId != null &&
        s.taskId !== id
      ) {
        pendingStartRef.current = { id, title };
        const end = nowIso();
        const elapsed = computeElapsedMs(s);
        setPendingStop({
          task_id: s.taskId,
          task_title: s.taskTitle ?? "Task",
          start_time: s.sessionStartedAt ?? s.startedAt ?? end,
          end_time: end,
          duration_mins: Math.max(1, Math.round(elapsed / 60000)),
        });
        return "needs_stop";
      }

      if (s.phase === "running" && s.taskId === id) return "ok";

      await ensureInProgress(id);
      const now = nowIso();
      const sameSession = s.taskId === id && s.phase === "paused";
      syncRef({
        phase: "running",
        taskId: id,
        taskTitle: title,
        startedAt: now,
        sessionStartedAt: sameSession
          ? (s.sessionStartedAt ?? now)
          : now,
        accumulatedMs: sameSession ? s.accumulatedMs : 0,
      });
      lastTickRef.current = Date.now();
      onChanged?.();
      return "ok";
    },
    [onChanged, pendingStop, syncRef],
  );

  const pause = useCallback(async () => {
    await pauseInternal("manual");
  }, [pauseInternal]);

  const resume = useCallback(async () => {
    const s = stateRef.current;
    if (s.phase !== "paused" || s.taskId == null || !s.taskTitle) return;
    await ensureInProgress(s.taskId);
    syncRef({
      phase: "running",
      startedAt: nowIso(),
    });
    lastTickRef.current = Date.now();
  }, [syncRef]);

  const requestStop = useCallback(() => {
    const s = stateRef.current;
    if (s.taskId == null) return;
    if (pendingStop) return;

    const end = nowIso();
    const elapsed = computeElapsedMs(s);
    setPendingStop({
      task_id: s.taskId,
      task_title: s.taskTitle ?? "Task",
      start_time: s.sessionStartedAt ?? s.startedAt ?? end,
      end_time: end,
      duration_mins: Math.max(1, Math.round(elapsed / 60000)),
    });
  }, [pendingStop]);

  const confirmStop = useCallback(
    async (description: string) => {
      const session = pendingStop;
      if (!session) return;
      const trimmed = description.trim();
      if (!trimmed) return;

      await addWorklog({
        task_id: session.task_id,
        start_time: session.start_time,
        end_time: session.end_time,
        duration_mins: session.duration_mins,
        description: trimmed,
      });

      const queued = pendingStartRef.current;
      pendingStartRef.current = null;
      setPendingStop(null);
      syncRef({
        phase: "idle",
        taskId: null,
        taskTitle: null,
        startedAt: null,
        sessionStartedAt: null,
        accumulatedMs: 0,
      });
      setElapsedMs(0);
      onChanged?.();

      if (queued) {
        await ensureInProgress(queued.id);
        const now = nowIso();
        syncRef({
          phase: "running",
          taskId: queued.id,
          taskTitle: queued.title,
          startedAt: now,
          sessionStartedAt: now,
          accumulatedMs: 0,
        });
        lastTickRef.current = Date.now();
        onChanged?.();
      }
    },
    [onChanged, pendingStop, syncRef],
  );

  const cancelStop = useCallback(() => {
    pendingStartRef.current = null;
    setPendingStop(null);
  }, []);

  // Live clock + sleep/gap detection
  useEffect(() => {
    const id = window.setInterval(() => {
      if (pendingStop) return;
      const now = Date.now();
      const gap = now - lastTickRef.current;
      lastTickRef.current = now;

      const s = stateRef.current;
      if (s.phase === "running" && s.startedAt) {
        if (gap > SLEEP_GAP_MS) {
          void pauseInternal("sleep");
          return;
        }
        setElapsedMs(computeElapsedMs(s, now));
      } else if (s.phase === "paused") {
        setElapsedMs(s.accumulatedMs);
      } else {
        setElapsedMs(0);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [pauseInternal, pendingStop]);

  // Cross-window sync (floating widget)
  useEffect(() => {
    const isWidget =
      new URLSearchParams(window.location.search).get("widget") === "1";

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = (ev) => {
        const data = ev.data as { type?: string; state?: PersistedTimer };
        if (data?.type === "sync" && data.state) {
          const s = data.state;
          stateRef.current = {
            phase: s.phase,
            taskId: s.taskId,
            taskTitle: s.taskTitle,
            startedAt: s.startedAt,
            sessionStartedAt: s.sessionStartedAt,
            accumulatedMs: s.accumulatedMs,
          };
          setPhase(s.phase);
          setTaskId(s.taskId);
          setTaskTitle(s.taskTitle);
          setStartedAt(s.startedAt);
          setAccumulatedMs(s.accumulatedMs);
          setElapsedMs(computeElapsedMs(s));
          if (s.phase === "idle") setPendingStop(null);
        }
        if (data?.type === "request-stop" && !isWidget) {
          requestStop();
        }
      };
    } catch {
      /* ignore */
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue) as PersistedTimer;
        stateRef.current = {
          phase: s.phase,
          taskId: s.taskId,
          taskTitle: s.taskTitle,
          startedAt: s.startedAt,
          sessionStartedAt: s.sessionStartedAt,
          accumulatedMs: s.accumulatedMs,
        };
        setPhase(s.phase);
        setTaskId(s.taskId);
        setTaskTitle(s.taskTitle);
        setStartedAt(s.startedAt);
        setAccumulatedMs(s.accumulatedMs);
        setElapsedMs(computeElapsedMs(s));
        if (s.phase === "idle") setPendingStop(null);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      bc?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [requestStop]);

  useEffect(() => {
    if (taskId != null && !taskTitle) {
      void getTask(taskId).then((t) => {
        if (t) syncRef({ taskTitle: t.title });
      });
    }
  }, [taskId, taskTitle, syncRef]);

  const snapshot: TimerSnapshot = {
    phase,
    taskId,
    taskTitle,
    startedAt,
    elapsedMs,
  };

  return {
    snapshot,
    phase,
    taskId,
    taskTitle,
    elapsedMs,
    pendingStop,
    start,
    pause,
    resume,
    requestStop,
    confirmStop,
    cancelStop,
    isPaused: phase === "paused",
    isRunning: phase === "running",
  };
}

/** Emit stop request from the floating widget into the main window. */
export function broadcastRequestStop(): void {
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage({ type: "request-stop" });
    bc.close();
  } catch {
    /* ignore */
  }
}
