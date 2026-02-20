"use client";

import { useSearchParams } from "next/navigation";

export function OauthResultBanner() {
  const searchParams = useSearchParams();
  const provider = searchParams.get("integration");
  const oauth = searchParams.get("oauth");
  const message = searchParams.get("message");

  if (provider !== "google_calendar" || !oauth) {
    return null;
  }

  const success = oauth === "success";
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-sm ${
        success
          ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
          : "border-rose-300/30 bg-rose-300/10 text-rose-100"
      }`}
    >
      {message ?? (success ? "Google Calendar connected." : "Google Calendar connection failed.")}
    </div>
  );
}
