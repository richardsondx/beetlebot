"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function InstallFromForageDialog() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [packRef, setPackRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function openPanel() {
    setOpen(true);
    setError(null);
    setSuccess(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function closePanel() {
    setOpen(false);
    setPackRef("");
    setError(null);
    setSuccess(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ref = packRef.trim();
    if (!ref) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/packs/install-from-forage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packRef: ref }),
      });
      const payload = (await res.json()) as {
        data?: { name: string };
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? "Failed to install pack.");

      setSuccess(`"${payload.data?.name}" installed successfully.`);
      setPackRef("");
      router.refresh();
      setTimeout(closePanel, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPanel}
        className="shrink-0 rounded-lg border border-sky-300/25 bg-sky-300/10 px-4 py-2 text-sm text-sky-100 transition-colors hover:bg-sky-300/20"
      >
        + From BeetlePack
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-sky-300/20 bg-sky-300/5 p-4">
      <p className="mb-2 text-xs text-sky-300/70">
        Install a pack from the{" "}
        <a
          href="https://forage.beetlebot.dev/packs"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-sky-300/40 hover:decoration-sky-300/70"
        >
          BeetlePack registry
        </a>
      </p>
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="@author/slug"
          value={packRef}
          onChange={(e) => setPackRef(e.target.value)}
          disabled={loading}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-sky-300/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !packRef.trim()}
          className="shrink-0 rounded-lg bg-sky-300/20 px-3 py-2 text-sm text-sky-100 transition-colors hover:bg-sky-300/30 disabled:opacity-50"
        >
          {loading ? "Installing…" : "Install"}
        </button>
        <button
          type="button"
          onClick={closePanel}
          disabled={loading}
          className="shrink-0 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-50"
        >
          Cancel
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      {success && <p className="mt-2 text-xs text-emerald-300">✓ {success}</p>}
    </div>
  );
}
