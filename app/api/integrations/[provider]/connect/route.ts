import {
  googleCalendarConnectSchema,
  opentableConnectSchema,
  telegramConnectSchema,
  weatherConnectSchema,
  whatsappConnectSchema,
} from "@/lib/api/schemas";
import { fail, fromError, ok } from "@/lib/api/http";
import { connectIntegration, isIntegrationProvider } from "@/lib/repositories/integrations";

type Params = { params: Promise<{ provider: string }> };

function resolveTelegramWebhookUrl(request: Request, explicitUrl?: string) {
  if (explicitUrl?.trim()) return explicitUrl.trim();
  const envBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.BEETLEBOT_BASE_URL?.trim();
  if (envBaseUrl?.startsWith("https://")) {
    return `${envBaseUrl.replace(/\/+$/, "")}/api/webhooks/telegram`;
  }
  const requestOrigin = new URL(request.url).origin;
  if (requestOrigin.startsWith("https://")) {
    return `${requestOrigin}/api/webhooks/telegram`;
  }
  return undefined;
}

async function readJsonBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { provider } = await params;
    if (!isIntegrationProvider(provider)) {
      return fail(`Unsupported provider: ${provider}`, 404);
    }
    const payload = await readJsonBody(request);

    if (provider === "telegram") {
      const body = telegramConnectSchema.parse(payload);
      return ok(
        await connectIntegration("telegram", {
          ...body,
          webhookUrl: resolveTelegramWebhookUrl(request, body.webhookUrl),
        }),
      );
    }
    if (provider === "whatsapp") {
      const body = whatsappConnectSchema.parse(payload);
      return ok(await connectIntegration("whatsapp", body));
    }
    if (provider === "weather") {
      const body = weatherConnectSchema.parse(payload);
      return ok(await connectIntegration("weather", body));
    }
    if (provider === "opentable") {
      const body = opentableConnectSchema.parse(payload);
      return ok(await connectIntegration("opentable", body));
    }

    const body = googleCalendarConnectSchema.parse(payload);
    const url = new URL(request.url);
    const fallbackRedirectUri = `${url.origin}/api/integrations/google-calendar/callback`;
    return ok(
      await connectIntegration("google_calendar", {
        ...body,
        redirectUri: body.redirectUri ?? fallbackRedirectUri,
      }),
    );
  } catch (error) {
    return fromError(error);
  }
}
