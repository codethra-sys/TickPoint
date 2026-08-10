/** 1 SP = 1 working day = 8h = 480 minutes */
export const MINS_PER_SP = 480;
export const MINS_PER_DAY = 480;
export const MINS_PER_WEEK = 2400;
export const MINS_PER_HOUR = 60;

/** Only these Fibonacci-lite values are allowed for estimates. */
export const ALLOWED_STORY_POINTS = [0.5, 1, 2, 3, 5] as const;
export type AllowedStoryPoint = (typeof ALLOWED_STORY_POINTS)[number];

export function isAllowedStoryPoint(value: number): value is AllowedStoryPoint {
  return (ALLOWED_STORY_POINTS as readonly number[]).includes(value);
}

export function storyPointsToMins(sp: number): number {
  return Math.round(sp * MINS_PER_SP);
}

export function minsToStoryPoints(mins: number): number {
  return mins / MINS_PER_SP;
}

/**
 * Format minutes into Jira-style estimate string (e.g. 1d 4h, 2h 30m, -1h 30m).
 * Uses 1w=5d=40h, 1d=8h.
 */
export function formatDuration(totalMins: number, opts?: { signed?: boolean }): string {
  const signed = opts?.signed ?? false;
  const negative = totalMins < 0;
  let mins = Math.abs(Math.round(totalMins));

  if (mins === 0) return "0m";

  const weeks = Math.floor(mins / MINS_PER_WEEK);
  mins %= MINS_PER_WEEK;
  const days = Math.floor(mins / MINS_PER_DAY);
  mins %= MINS_PER_DAY;
  const hours = Math.floor(mins / MINS_PER_HOUR);
  mins %= MINS_PER_HOUR;

  const parts: string[] = [];
  if (weeks) parts.push(`${weeks}w`);
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins) parts.push(`${mins}m`);

  const body = parts.join(" ");
  if (signed && negative) return `-${body}`;
  if (negative) return `-${body}`;
  return body;
}

export function formatRemaining(remainingMins: number): {
  label: string;
  isOver: boolean;
} {
  if (remainingMins < 0) {
    return {
      label: `${formatDuration(Math.abs(remainingMins))} over`,
      isOver: true,
    };
  }
  return {
    label: formatDuration(remainingMins),
    isOver: false,
  };
}

export function formatTimerClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function durationMinsBetween(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(1, Math.round(ms / 60000));
}
