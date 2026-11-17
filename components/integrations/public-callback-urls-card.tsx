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
      className="shrink-0 rounded-md border border-[#E7E5E0] bg-[#F2F1EE] px-2 py-1 text-xs text-[#6B6862] transition-colors hover:bg-[#F2F1EE]"
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
      <section className="rounded-2xl border border-[#E7E5E0] bg-white p-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E5EFFB] text-sm">
            🌐
          </span>
          <h2 className="text-sm font-semibold text-[#1C1B19]">Public callback URLs</h2>
        </div>
        <p className="text-sm text-[#6B6862]">
          No public base URL is configured yet.
        </p>
        <p className="mt-2 text-xs text-[#6B6862]">
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
    <section className="rounded-2xl border border-[#E7E5E0] bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E5EFFB] text-sm">
          🌐
        </span>
        <h2 className="text-sm font-semibold text-[#1C1B19]">Public callback URLs</h2>
      </div>

      <div className="space-y-3">
        {urls.map((item) => (
          <div key={item.label} className="space-y-1">
            <p className="text-xs font-medium text-[#6B6862]">{item.label}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-[#E7E5E0] bg-[#F2F1EE] px-3 py-2 text-xs text-[#1C1B19]">
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
