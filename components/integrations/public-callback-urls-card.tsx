"use client";

import { useState } from "react";

type UrlItem = {
  label: string;
  value: string;
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-white/10"
      aria-label="Copy URL"
      title="Copy URL"
    >
      {copied ? "Copied!" : "📋"}
    </button>
  );
}

export function PublicCallbackUrlsCard({
  baseUrl,
}: {
  baseUrl?: string;
}) {
  const normalizedBaseUrl = baseUrl?.trim().replace(/\/+$/, "");

  if (!normalizedBaseUrl) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-300/10 text-sm">
            🌐
          </span>
          <h2 className="text-sm font-semibold text-slate-100">Public callback URLs</h2>
        </div>
        <p className="text-sm text-slate-400">
          No public base URL is configured yet.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Set <code className="font-mono">NEXT_PUBLIC_APP_URL</code> (or{" "}
          <code className="font-mono">BEETLEBOT_BASE_URL</code>) to show copyable callback URLs here.
        </p>
      </section>
    );
  }

  const urls: UrlItem[] = [
    { label: "Public Base URL", value: normalizedBaseUrl },
    {
      label: "Google Calendar Redirect URI",
      value: `${normalizedBaseUrl}/api/integrations/google-calendar/callback`,
    },
    {
      label: "WhatsApp Webhook URL",
      value: `${normalizedBaseUrl}/api/webhooks/whatsapp`,
    },
    {
      label: "Telegram Webhook URL",
      value: `${normalizedBaseUrl}/api/webhooks/telegram`,
    },
  ];

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-300/10 text-sm">
          🌐
        </span>
        <h2 className="text-sm font-semibold text-slate-100">Public callback URLs</h2>
      </div>

      <div className="space-y-3">
        {urls.map((item) => (
          <div key={item.label} className="space-y-1">
            <p className="text-xs font-medium text-slate-400">{item.label}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                {item.value}
              </code>
              <CopyButton value={item.value} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
