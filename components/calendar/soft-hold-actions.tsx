"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SoftHold = {
  id: string;
  title: string;
  startAtIso: string;
  endAtIso: string;
  status: "held" | "released";
};

type Props = {
  hold: SoftHold;
};

function isoToLocalInput(iso: string) {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function localInputToIso(value: string) {
  return new Date(value).toISOString();
}

export function SoftHoldActions({ hold }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "release" | "delete">("view");
  const [saving, setSaving] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: hold.title,
    startAt: isoToLocalInput(hold.startAtIso),
    endAt: isoToLocalInput(hold.endAtIso),
  });

  const hasChanges = useMemo(
    () =>
      form.title !== hold.title ||
      form.startAt !== isoToLocalInput(hold.startAtIso) ||
      form.endAt !== isoToLocalInput(hold.endAtIso),
    [form, hold.endAtIso, hold.startAtIso, hold.title],
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (new Date(form.startAt) >= new Date(form.endAt)) {
        throw new Error("End time must be after start time.");
      }

      const res = await fetch(`/api/calendar/soft-holds/${hold.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          startAt: localInputToIso(form.startAt),
          endAt: localInputToIso(form.endAt),
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Could not update hold.");
      setMode("view");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRelease() {
    setReleasing(true);
    setError("");
    try {
      const res = await fetch(`/api/calendar/soft-holds/${hold.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "released" }),
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not release hold.");
      }
      setMode("view");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setReleasing(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/calendar/soft-holds/${hold.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not delete hold.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setDeleting(false);
    }
  }

  if (mode === "delete") {
    return (
      <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/8 p-3">
        <p className="text-xs text-rose-200">Permanently delete this hold?</p>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="rounded-md border border-rose-300/30 bg-rose-300/15 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-300/25 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Yes, delete"}
          </button>
          <button
            onClick={() => {
              setMode("view");
              setError("");
            }}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      </div>
    );
  }

  if (mode === "release") {
    return (
      <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/8 p-3">
        <p className="text-xs text-rose-200">Release this hold?</p>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => void handleRelease()}
            disabled={releasing}
            className="rounded-md border border-rose-300/30 bg-rose-300/15 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-300/25 disabled:opacity-50"
          >
            {releasing ? "Releasing..." : "Yes, release"}
          </button>
          <button
            onClick={() => {
              setMode("view");
              setError("");
            }}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      </div>
    );
  }

  if (mode === "edit") {
    return (
      <form onSubmit={(e) => void handleSave(e)} className="mt-3 space-y-3 rounded-lg border border-white/10 bg-[#0a1120] p-3">
        <label className="block text-xs text-slate-400">
          Title
          <input
            required
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#060b12] px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-300/40 focus:ring-1 focus:ring-amber-300/20"
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">
            Start
            <input
              required
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => setForm((prev) => ({ ...prev, startAt: e.target.value }))}
              className="mt-1 w-full rounded-md border border-white/10 bg-[#060b12] px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-300/40 focus:ring-1 focus:ring-amber-300/20"
            />
          </label>
          <label className="block text-xs text-slate-400">
            End
            <input
              required
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => setForm((prev) => ({ ...prev, endAt: e.target.value }))}
              className="mt-1 w-full rounded-md border border-white/10 bg-[#060b12] px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-300/40 focus:ring-1 focus:ring-amber-300/20"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving || !hasChanges}
            className="rounded-md border border-amber-300/25 bg-amber-300/15 px-2.5 py-1 text-xs text-amber-100 hover:bg-amber-300/25 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("view");
              setError("");
              setForm({
                title: hold.title,
                startAt: isoToLocalInput(hold.startAtIso),
                endAt: isoToLocalInput(hold.endAtIso),
              });
            }}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-rose-300">{error}</p>}
      </form>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        onClick={() => setMode("edit")}
        className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:border-white/20 hover:text-slate-100"
      >
        Edit
      </button>
      {hold.status === "held" && (
        <button
          onClick={() => setMode("release")}
          className="rounded-md border border-rose-300/20 bg-rose-300/8 px-2 py-1 text-xs text-rose-300 hover:bg-rose-300/15"
        >
          Release
        </button>
      )}
    </div>
  );
}
