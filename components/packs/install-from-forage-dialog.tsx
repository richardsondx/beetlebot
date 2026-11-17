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
        className="shrink-0 rounded-lg border border-[#E7E5E0] bg-[#E5EFFB] px-4 py-2 text-sm text-[#2F5FA8] transition-colors hover:bg-[#E5EFFB]"
      >
        + From BeetlePack
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-[#E7E5E0] bg-[#E5EFFB] p-4">
      <p className="mb-2 text-xs text-[#2F5FA8]">
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
          className="min-w-0 flex-1 rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] px-3 py-2 text-sm text-[#1C1B19] placeholder-[#9A968F] outline-none focus:border-[#E7E5E0] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !packRef.trim()}
          className="shrink-0 rounded-lg bg-[#E5EFFB] px-3 py-2 text-sm text-[#2F5FA8] transition-colors hover:bg-[#E5EFFB] disabled:opacity-50"
        >
          {loading ? "Installing…" : "Install"}
        </button>
        <button
          type="button"
          onClick={closePanel}
          disabled={loading}
          className="shrink-0 rounded-lg px-3 py-2 text-sm text-[#6B6862] transition-colors hover:text-[#6B6862] disabled:opacity-50"
        >
          Cancel
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-[#C23B32]">{error}</p>}
      {success && <p className="mt-2 text-xs text-[#2F7D4F]">✓ {success}</p>}
    </div>
  );
}
