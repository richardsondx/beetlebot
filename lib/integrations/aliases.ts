import type { IntegrationProvider } from "@/lib/integrations/types";

const NEED_ALIAS_MAP: Record<string, IntegrationProvider> = {
  calendar: "google_calendar",
  google_calendar: "google_calendar",
  opentable: "opentable",
  weather: "weather",
  telegram: "telegram",
  whatsapp: "whatsapp",
  maps: "maps",
};

export function resolveNeedAlias(alias: string): IntegrationProvider | null {
  return NEED_ALIAS_MAP[alias] ?? null;
}

export function parseNeedString(need: string): {
  alias: string;
  scope: string;
} | null {
  const parts = need.split(":");
  if (parts.length !== 2) return null;
  return { alias: parts[0], scope: parts[1] };
}
