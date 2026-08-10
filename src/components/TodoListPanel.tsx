import { useState, type FormEvent } from "react";
import { ArrowUpRight, Pencil, Trash2, X } from "lucide-react";
import {
  ALLOWED_STORY_POINTS,
  formatDuration,
  storyPointsToMins,
} from "../lib/time";
import type { TaskTag, TodoItem } from "../types";
import { TASK_TAGS, TAG_COLORS } from "../types";

interface Props {
  todos: TodoItem[];
  onAdd: (title: string) => Promise<void>;
  onToggle: (id: number, done: boolean) => Promise<void>;
  onEdit: (id: number, title: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onPromote: (
    todo: TodoItem,
    storyPoints: number,
    tag: TaskTag,
  ) => Promise<void>;
}

export function TodoListPanel({
  todos,
  onAdd,
  onToggle,
  onEdit,
  onDelete,
  onPromote,
}: Props) {
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [promoteTodo, setPromoteTodo] = useState<TodoItem | null>(null);
  const [sp, setSp] = useState("1");
  const [promoteTag, setPromoteTag] = useState<TaskTag | "">("");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await onAdd(title.trim());
    setTitle("");
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a to-do…"
          className="min-w-0 flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
        <button type="submit" className="btn btn-primary h-10 px-4">
          Add
        </button>
      </form>

      <ul className="space-y-2">
        {todos.length === 0 && (
          <li className="rounded-xl border border-dashed border-[var(--color-line)] px-4 py-8 text-center text-sm text-[var(--color-muted)]">
            No to-dos yet.
          </li>
        )}
        {todos.map((todo) => {
          const done = Boolean(todo.is_done);
          const editing = editingId === todo.id;
          return (
            <li
              key={todo.id}
              className="surface flex items-center gap-3 rounded-xl px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => void onToggle(todo.id, !done)}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  done
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[#062a28]"
                    : "border-[var(--color-line)] hover:border-[var(--color-accent)]"
                }`}
                aria-label={done ? "Mark not done" : "Mark done"}
              >
                {done ? "✓" : ""}
              </button>

              {editing ? (
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="min-w-0 flex-1 rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] px-2 py-1 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void onEdit(todo.id, editTitle).then(() =>
                        setEditingId(null),
                      );
                    }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <span
                  className={`min-w-0 flex-1 text-sm ${done ? "text-[var(--color-muted)] line-through" : ""}`}
                >
                  {todo.title}
                </span>
              )}

              {!done && (
                <div className="flex shrink-0 items-center gap-1">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary h-8 px-2 text-xs"
                        onClick={() =>
                          void onEdit(todo.id, editTitle).then(() =>
                            setEditingId(null),
                          )
                        }
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon"
                        onClick={() => setEditingId(null)}
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        title="Promote to Task"
                        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15"
                        onClick={() => {
                          setPromoteTodo(todo);
                          setSp("1");
                          setPromoteTag("");
                        }}
                      >
                        <ArrowUpRight size={14} /> Promote
                      </button>
                      <button
                        type="button"
                        title="Edit"
                        className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-panel-2)] hover:text-[var(--color-text)]"
                        onClick={() => {
                          setEditingId(todo.id);
                          setEditTitle(todo.title);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)]"
                        onClick={() => void onDelete(todo.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {promoteTodo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4 shadow-2xl">
            <h3 className="text-base font-semibold">Promote to Task</h3>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {promoteTodo.title}
            </p>
            <label className="mt-4 block text-xs text-[var(--color-muted)]">
              Story points
              <select
                value={sp}
                onChange={(e) => setSp(e.target.value)}
                className="mono mt-1 w-full rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3 py-2 text-sm"
              >
                {ALLOWED_STORY_POINTS.map((v) => (
                  <option key={v} value={v}>
                    {v} SP · {formatDuration(storyPointsToMins(v))}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 text-xs text-[var(--color-muted)]">
              Tag <span className="text-[var(--color-danger)]">*</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {TASK_TAGS.map((value) => {
                  const on = promoteTag === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPromoteTag(value)}
                      className="rounded-md border px-2 py-1 text-[11px]"
                      style={{
                        borderColor: on ? TAG_COLORS[value] : "var(--color-line)",
                        background: on
                          ? `${TAG_COLORS[value]}22`
                          : "transparent",
                        color: on ? TAG_COLORS[value] : "var(--color-muted)",
                      }}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary h-9"
                onClick={() => setPromoteTodo(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary h-9 disabled:opacity-40"
                disabled={!promoteTag}
                onClick={() => {
                  if (!promoteTag) return;
                  void onPromote(promoteTodo, Number(sp), promoteTag).then(
                    () => setPromoteTodo(null),
                  );
                }}
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
