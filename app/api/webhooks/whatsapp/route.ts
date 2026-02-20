import { ok } from "@/lib/api/http";
import { db } from "@/lib/db";
import { decryptConnection } from "@/lib/repositories/integration-crypto";

type WhatsAppWebhookQuery = {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
};

type WhatsAppWebhookMessage = {
  id?: string;
  from?: string;
  text?: { body?: string };
  type?: string;
};

type WhatsAppWebhookStatus = {
  id?: string;
  status?: string;
};

type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        messages?: WhatsAppWebhookMessage[];
        statuses?: WhatsAppWebhookStatus[];
      };
    }>;
  }>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries()) as WhatsAppWebhookQuery;
  const mode = params["hub.mode"]?.trim();
  const verifyToken = params["hub.verify_token"]?.trim();
  const challenge = params["hub.challenge"]?.trim();
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  const tokenMatches = Boolean(expectedToken && verifyToken && verifyToken === expectedToken);

  if (mode === "subscribe" && tokenMatches && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return ok(
    {
      verified: false,
      reason: "invalid_verification_request",
    },
    403,
  );
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as WhatsAppWebhookPayload | null;
  const entries = payload?.entry ?? [];
  const changes = entries.flatMap((entry) => entry.changes ?? []);
  const messageEvents = changes.flatMap((change) => change.value?.messages ?? []);
  const statusEvents = changes.flatMap((change) => change.value?.statuses ?? []);
  const phoneNumberId = changes.find((change) => change.value?.metadata?.phone_number_id)?.value?.metadata
    ?.phone_number_id;

  const rawWhatsApp = await db.integrationConnection.findUnique({
    where: { provider: "whatsapp" },
  });
  const whatsapp = rawWhatsApp ? decryptConnection(rawWhatsApp) : null;

  if (!payload) {
    return ok({ received: false, ignored: true, reason: "invalid_json" });
  }

  const firstText = messageEvents.find((event) => event.type === "text")?.text?.body?.trim();

  return ok({
    received: true,
    handled: false,
    reason: "instrumented_only_whatsapp_ingress",
    messageCount: messageEvents.length,
    statusCount: statusEvents.length,
  });
}
