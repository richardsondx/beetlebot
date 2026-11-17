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
          ? "border-[#E7E5E0] bg-[#E6F4EA] text-[#2F7D4F]"
          : "border-[#E7E5E0] bg-[#FBE8EC] text-[#C23B32]"
      }`}
    >
      {message ?? (success ? "Google Calendar connected." : "Google Calendar connection failed.")}
    </div>
  );
}
