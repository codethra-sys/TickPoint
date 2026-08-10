import { useState, type FormEvent } from "react";
import { formatDuration } from "../lib/time";
import type { PendingStopSession } from "../types";

interface Props {
  session: PendingStopSession;
  onConfirm: (description: string) => Promise<void>;
  onCancel: () => void;
}

export function SessionDescriptionModal({
  session,
  onConfirm,
  onCancel,
}: Props) {
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = description.trim();
    if (!trimmed) {
      setError("Description is required to save this worklog.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save worklog");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] shadow-2xl"
      >
        <div className="border-b border-[var(--color-line)] px-4 py-3">
          <h2 className="text-base font-semibold">
            What did you accomplish during this session?
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {session.task_title} · {formatDuration(session.duration_mins)}
          </p>
        </div>

        <div className="space-y-3 px-4 py-4">
          <label className="block text-xs font-medium text-[var(--color-muted)]">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              autoFocus
              required
              placeholder="Summarize what you completed…"
              className="mt-1 w-full resize-y rounded border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded border border-[var(--color-line)] px-3 py-2 text-sm hover:bg-[var(--color-panel-2)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !description.trim()}
              className="rounded bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-[#062a28] disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save worklog"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
