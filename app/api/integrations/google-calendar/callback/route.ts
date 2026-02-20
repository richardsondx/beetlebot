import { NextResponse } from "next/server";
import { connectIntegration, setIntegrationError } from "@/lib/repositories/integrations";

function decodeStateReturnTo(state?: string | null) {
  if (!state) return "/settings";
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded) as { returnTo?: string };
    const target = parsed.returnTo;
    if (typeof target === "string" && target.startsWith("/")) return target;
    return "/settings";
  } catch {
    return "/settings";
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");
  const returnTo = decodeStateReturnTo(state);
  const redirectBase = new URL(returnTo, requestUrl.origin);

  if (oauthError) {
    const message = `Google OAuth rejected: ${oauthError}`;
    await setIntegrationError("google_calendar", message);
    redirectBase.searchParams.set("integration", "google_calendar");
    redirectBase.searchParams.set("oauth", "error");
    redirectBase.searchParams.set("message", message);
    return NextResponse.redirect(redirectBase);
  }

  if (!code) {
    const message = "Google OAuth callback missing code parameter";
    await setIntegrationError("google_calendar", message);
    redirectBase.searchParams.set("integration", "google_calendar");
    redirectBase.searchParams.set("oauth", "error");
    redirectBase.searchParams.set("message", message);
    return NextResponse.redirect(redirectBase);
  }

  try {
    await connectIntegration("google_calendar", {
      code,
      state: state ?? undefined,
      redirectUri: `${requestUrl.origin}/api/integrations/google-calendar/callback`,
    });
    redirectBase.searchParams.set("integration", "google_calendar");
    redirectBase.searchParams.set("oauth", "success");
    redirectBase.searchParams.set("message", "Google Calendar connected.");
    return NextResponse.redirect(redirectBase);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google OAuth exchange failed";
    redirectBase.searchParams.set("integration", "google_calendar");
    redirectBase.searchParams.set("oauth", "error");
    redirectBase.searchParams.set("message", message);
    return NextResponse.redirect(redirectBase);
  }
}
