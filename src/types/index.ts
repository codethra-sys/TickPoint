export type TaskStatus = "todo" | "in_progress" | "done";

export const TASK_TAGS = [
  "Bug Fixing",
  "Meetings",
  "KT",
  "Dev",
  "INC Resolution",
  "Maintenance",
  "Planning",
] as const;

export type TaskTag = (typeof TASK_TAGS)[number];

export const TAG_COLORS: Record<TaskTag, string> = {
  "Bug Fixing": "#e35d6a",
  Meetings: "#e6a23c",
  KT: "#7c9cff",
  Dev: "#2bb0a6",
  "INC Resolution": "#c084fc",
  Maintenance: "#8aa0b4",
  Planning: "#3dba7a",
};

export interface Task {
  id: number;
  title: string;
  story_points: number;
  original_estimate_mins: number;
  status: TaskStatus;
  is_high_priority: number | boolean;
  description: string | null;
  tags: string | null;
  created_at: string;
  logged_mins?: number;
}

export interface Worklog {
  id: number;
  task_id: number;
  start_time: string;
  end_time: string;
  duration_mins: number;
  description: string | null;
  created_at: string;
  task_title?: string;
  task_tags?: string | null;
}

export interface TaskWithStats extends Task {
  logged_mins: number;
  remaining_mins: number;
  /** Single mandatory category tag. */
  tag: TaskTag | null;
}

export interface TodoItem {
  id: number;
  title: string;
  is_done: number | boolean;
  created_at: string;
}

export type TimerPhase = "idle" | "running" | "paused";

export interface TimerSnapshot {
  phase: TimerPhase;
  taskId: number | null;
  taskTitle: string | null;
  startedAt: string | null;
  elapsedMs: number;
}

export interface PendingStopSession {
  task_id: number;
  task_title: string;
  start_time: string;
  end_time: string;
  duration_mins: number;
}

export function parseTag(raw: string | null | undefined): TaskTag | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const first = parsed[0];
      if (
        typeof first === "string" &&
        (TASK_TAGS as readonly string[]).includes(first)
      ) {
        return first as TaskTag;
      }
      return null;
    }
    if (
      typeof parsed === "string" &&
      (TASK_TAGS as readonly string[]).includes(parsed)
    ) {
      return parsed as TaskTag;
    }
  } catch {
    if ((TASK_TAGS as readonly string[]).includes(raw)) {
      return raw as TaskTag;
    }
  }
  return null;
}

export function serializeTag(tag: TaskTag): string {
  return JSON.stringify([tag]);
}

/** @deprecated use parseTag — kept for reading multi-tag legacy rows */
export function parseTags(raw: string | null | undefined): TaskTag[] {
  const tag = parseTag(raw);
  return tag ? [tag] : [];
}
