"use client";

import { useEffect, useState } from "react";

type NeedIssue = { need: string; reason: string };

type InstallPackButtonProps = {
  slug: string;
  installed: boolean;
  needs: string[];
};

export function InstallPackButton({ slug, installed, needs }: InstallPackButtonProps) {
  const [isInstalled, setInstalled] = useState(installed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopeIssues, setScopeIssues] = useState<NeedIssue[]>([]);
  const [confirmUninstall, setConfirmUninstall] = useState(false);

  useEffect(() => {
    if (needs.length === 0 || isInstalled) return;
    fetch("/api/packs/check-needs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ needs }),
    })
      .then((r) => r.json() as Promise<{ data?: { issues: NeedIssue[] } }>)
      .then((payload) => {
        if (payload.data?.issues?.length) {
          setScopeIssues(payload.data.issues);
        }
      })
      .catch(() => {});
  }, [needs, isInstalled]);

  async function onInstall() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/packs/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to install pack.");
      setInstalled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  async function onUninstall() {
    setLoading(true);
    setError(null);
    setConfirmUninstall(false);
    try {
      const response = await fetch("/api/packs/install", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Failed to uninstall pack.");
      setInstalled(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  if (isInstalled) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-emerald-300/80">
            <span className="text-[10px]">✓</span>
            Installed
          </span>
          {confirmUninstall ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Remove this pack?</span>
              <button
                type="button"
                onClick={() => void onUninstall()}
                disabled={loading}
                className="rounded px-2 py-1 text-xs text-rose-300 transition-colors hover:bg-rose-400/10 disabled:opacity-50"
              >
                {loading ? "Removing…" : "Yes, remove"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmUninstall(false)}
                className="rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmUninstall(true)}
              disabled={loading}
              className="text-xs text-slate-600 transition-colors hover:text-rose-300 disabled:opacity-50"
            >
              Uninstall
            </button>
          )}
        </div>
        {error && <p className="text-xs text-rose-300">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => void onInstall()}
        disabled={loading}
        className="rounded-lg bg-amber-300/20 px-3 py-2 text-xs text-amber-100 transition-colors hover:bg-amber-300/30 disabled:opacity-60"
      >
        {loading ? "Installing…" : "Install pack"}
      </button>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {scopeIssues.length > 0 && (
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs text-amber-300">
          <p className="mb-1 font-medium">Missing integration permissions:</p>
          <ul className="space-y-0.5">
            {scopeIssues.map((issue) => (
              <li key={issue.need}>
                <span className="font-mono">{issue.need}</span> — {issue.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

