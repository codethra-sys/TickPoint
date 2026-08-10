import Database from "@tauri-apps/plugin-sql";
import type {
  Task,
  TaskStatus,
  TaskTag,
  TaskWithStats,
  TodoItem,
  Worklog,
} from "../types";
import { parseTag, serializeTag } from "../types";
import { storyPointsToMins } from "./time";

const DB_URL = "sqlite:timetracker.db";

let dbPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
}

function asBoolInt(value: boolean | number | undefined): number {
  return value ? 1 : 0;
}

function mapTask(
  row: Task & { logged_mins: number | null },
): TaskWithStats {
  const logged = Number(row.logged_mins ?? 0);
  return {
    ...row,
    description: row.description ?? null,
    tags: row.tags ?? null,
    logged_mins: logged,
    remaining_mins: row.original_estimate_mins - logged,
    tag: parseTag(row.tags),
  };
}

export async function listTasks(): Promise<TaskWithStats[]> {
  const db = await getDb();
  const rows = await db.select<(Task & { logged_mins: number | null })[]>(
    `SELECT t.*,
            COALESCE((SELECT SUM(w.duration_mins) FROM worklogs w WHERE w.task_id = t.id), 0) AS logged_mins
     FROM tasks t
     ORDER BY t.is_high_priority DESC, t.created_at DESC`,
  );
  return rows.map(mapTask);
}

export async function getTask(id: number): Promise<TaskWithStats | null> {
  const tasks = await listTasks();
  return tasks.find((t) => t.id === id) ?? null;
}

export async function createTask(input: {
  title: string;
  story_points: number;
  is_high_priority?: boolean;
  description?: string | null;
  tag: TaskTag;
}): Promise<number> {
  const db = await getDb();
  const estimate = storyPointsToMins(input.story_points);
  const result = await db.execute(
    `INSERT INTO tasks (title, story_points, original_estimate_mins, status, is_high_priority, description, tags)
     VALUES ($1, $2, $3, 'todo', $4, $5, $6)`,
    [
      input.title.trim(),
      input.story_points,
      estimate,
      asBoolInt(input.is_high_priority),
      input.description?.trim() || null,
      serializeTag(input.tag),
    ],
  );
  return result.lastInsertId as number;
}

export async function updateTask(
  id: number,
  input: {
    title: string;
    story_points: number;
    status: TaskStatus;
    is_high_priority: boolean;
    description?: string | null;
    tag: TaskTag;
  },
): Promise<void> {
  const db = await getDb();
  const estimate = storyPointsToMins(input.story_points);
  await db.execute(
    `UPDATE tasks
     SET title = $1, story_points = $2, original_estimate_mins = $3,
         status = $4, is_high_priority = $5, description = $6, tags = $7
     WHERE id = $8`,
    [
      input.title.trim(),
      input.story_points,
      estimate,
      input.status,
      asBoolInt(input.is_high_priority),
      input.description?.trim() || null,
      serializeTag(input.tag),
      id,
    ],
  );
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM worklogs WHERE task_id = $1`, [id]);
  await db.execute(`DELETE FROM tasks WHERE id = $1`, [id]);
}

export async function setTaskStatus(
  id: number,
  status: TaskStatus,
): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE tasks SET status = $1 WHERE id = $2`, [status, id]);
}

export async function ensureInProgress(taskId: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tasks SET status = 'in_progress'
     WHERE id = $1 AND status = 'todo'`,
    [taskId],
  );
}

export async function addWorklog(input: {
  task_id: number;
  start_time: string;
  end_time: string;
  duration_mins: number;
  description?: string | null;
}): Promise<number> {
  const db = await getDb();
  await ensureInProgress(input.task_id);
  const result = await db.execute(
    `INSERT INTO worklogs (task_id, start_time, end_time, duration_mins, description)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.task_id,
      input.start_time,
      input.end_time,
      input.duration_mins,
      input.description ?? null,
    ],
  );
  return result.lastInsertId as number;
}

export async function updateWorklog(
  id: number,
  input: {
    start_time: string;
    end_time: string;
    duration_mins: number;
    description: string;
  },
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE worklogs
     SET start_time = $1, end_time = $2, duration_mins = $3, description = $4
     WHERE id = $5`,
    [
      input.start_time,
      input.end_time,
      input.duration_mins,
      input.description.trim(),
      id,
    ],
  );
}

export async function listWorklogs(taskId?: number): Promise<Worklog[]> {
  const db = await getDb();
  if (taskId != null) {
    return db.select<Worklog[]>(
      `SELECT w.*, t.title AS task_title, t.tags AS task_tags
       FROM worklogs w
       JOIN tasks t ON t.id = w.task_id
       WHERE w.task_id = $1
       ORDER BY w.start_time DESC`,
      [taskId],
    );
  }
  return db.select<Worklog[]>(
    `SELECT w.*, t.title AS task_title, t.tags AS task_tags
     FROM worklogs w
     JOIN tasks t ON t.id = w.task_id
     ORDER BY w.start_time DESC
     LIMIT 500`,
  );
}

export async function deleteWorklog(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM worklogs WHERE id = $1`, [id]);
}

export async function selectableTasks(): Promise<TaskWithStats[]> {
  const tasks = await listTasks();
  return tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const hp = Number(b.is_high_priority) - Number(a.is_high_priority);
      if (hp !== 0) return hp;
      return a.title.localeCompare(b.title);
    });
}

export async function listTodos(): Promise<TodoItem[]> {
  const db = await getDb();
  return db.select<TodoItem[]>(
    `SELECT * FROM todos ORDER BY is_done ASC, created_at DESC`,
  );
}

export async function createTodo(title: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO todos (title, is_done) VALUES ($1, 0)`,
    [title.trim()],
  );
  return result.lastInsertId as number;
}

export async function updateTodo(
  id: number,
  input: { title?: string; is_done?: boolean },
): Promise<void> {
  const db = await getDb();
  if (input.title != null && input.is_done != null) {
    await db.execute(
      `UPDATE todos SET title = $1, is_done = $2 WHERE id = $3`,
      [input.title.trim(), asBoolInt(input.is_done), id],
    );
    return;
  }
  if (input.title != null) {
    await db.execute(`UPDATE todos SET title = $1 WHERE id = $2`, [
      input.title.trim(),
      id,
    ]);
    return;
  }
  if (input.is_done != null) {
    await db.execute(`UPDATE todos SET is_done = $1 WHERE id = $2`, [
      asBoolInt(input.is_done),
      id,
    ]);
  }
}

export async function deleteTodo(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM todos WHERE id = $1`, [id]);
}
