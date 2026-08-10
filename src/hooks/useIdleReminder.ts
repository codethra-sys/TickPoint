import { useEffect, useRef, useState } from "react";
import type { TimerPhase } from "../types";

const IDLE_MS = 2 * 60 * 1000;
const SNOOZE_MS = 15 * 60 * 1000;

export function useIdleReminder(
  phase: TimerPhase,
  enabled = true,
): {
  showIdleModal: boolean;
  snooze: () => void;
  dismiss: () => void;
} {
  const [showIdleModal, setShowIdleModal] = useState(false);
  const snoozeUntilRef = useRef(0);
  const lastActiveRef = useRef(Date.now());

  useEffect(() => {
    if (phase !== "idle") {
      lastActiveRef.current = Date.now();
      setShowIdleModal(false);
    }
  }, [phase]);

  useEffect(() => {
    if (!enabled) return;

    const tick = window.setInterval(() => {
      if (phase !== "idle") return;
      if (Date.now() < snoozeUntilRef.current) return;

      const idleFor = Date.now() - lastActiveRef.current;
      if (idleFor >= IDLE_MS) {
        setShowIdleModal(true);
        lastActiveRef.current = Date.now();
      }
    }, 5_000);

    return () => window.clearInterval(tick);
  }, [enabled, phase]);

  const snooze = () => {
    snoozeUntilRef.current = Date.now() + SNOOZE_MS;
    lastActiveRef.current = Date.now();
    setShowIdleModal(false);
  };

  const dismiss = () => {
    lastActiveRef.current = Date.now();
    setShowIdleModal(false);
  };

  return { showIdleModal, snooze, dismiss };
}
