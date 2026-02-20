import { db } from "@/lib/db";
import { integrationAdapters } from "@/lib/integrations/adapters";
import {
  AdapterConnectResult,
  AnyConnectInput,
  ConnectInputByProvider,
  IntegrationCatalogItem,
  IntegrationProvider,
  IntegrationScope,
} from "@/lib/integrations/types";
import { ensureSeedData } from "@/lib/repositories/seed";
import {
  decryptConnection,
  encryptConnectionFields,
} from "@/lib/repositories/integration-crypto";

const CATALOG: Record<IntegrationProvider, IntegrationCatalogItem> = {
  telegram: {
    provider: "telegram",
    kind: "channel",
    displayName: "Telegram",
    description: "Telegram bot connection for 1:1 and group chat workflows.",
    availableScopes: ["read", "write"],
    defaultScopes: ["read"],
  },
  whatsapp: {
    provider: "whatsapp",
    kind: "channel",
    displayName: "WhatsApp",
    description: "Meta WhatsApp Cloud API connection for messaging workflows.",
    availableScopes: ["read", "write"],
    defaultScopes: ["read"],
  },
  google_calendar: {
    provider: "google_calendar",
    kind: "calendar",
    displayName: "Google Calendar",
    description: "Google Calendar OAuth connection for scheduling context and holds.",
    availableScopes: ["read", "write", "delete"],
    defaultScopes: ["read"],
  },
  weather: {
    provider: "weather",
    kind: "context",
    displayName: "Weather",
    description: "Weather provider connection for forecast-aware planning and recommendations.",
    availableScopes: ["read"],
    defaultScopes: ["read"],
  },
  opentable: {
    provider: "opentable",
    kind: "reservation",
    displayName: "OpenTable",
    description: "Search restaurants and check real-time availability via OpenTable.",
    availableScopes: ["read", "write"],
    defaultScopes: ["read"],
  },
  maps: {
    provider: "maps",
    kind: "context",
    displayName: "Maps",
    description:
      "Directions, travel time, and distance estimates for smarter buffers and logistics.",
    availableScopes: ["read"],
    defaultScopes: ["read"],
  },
};

function parseConfig(configJson?: string | null): Record<string, unknown> {
  if (!configJson) return {};
  try {
    return JSON.parse(configJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseScopes(raw?: string | null): IntegrationScope[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as IntegrationScope[];
  } catch {
    return [];
  }
}

function readScopesFromConfig(configJson?: string | null): IntegrationScope[] {
  const config = parseConfig(configJson);
  const raw = config.grantedScopes;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is IntegrationScope =>
    typeof v === "string" && (v === "read" || v === "write" || v === "delete"),
  );
}

function mergeConfigWithScopes(
  configJson: string | null | undefined,
  scopes: IntegrationScope[],
): string {
  const config = parseConfig(configJson);
  return JSON.stringify({
    ...config,
    grantedScopes: scopes,
  });
}

function getEffectiveScopes(connection: {
  configJson?: string | null;
  grantedScopes?: string | null;
}): IntegrationScope[] {
  const configScopes = readScopesFromConfig(connection.configJson);
  if (configScopes.length) return configScopes;
  return parseScopes(connection.grantedScopes);
}

function toPublic(connection: Awaited<ReturnType<typeof ensureConnection>>) {
  const catalogEntry = CATALOG[connection.provider as IntegrationProvider];
  return {
    id: connection.id,
    provider: connection.provider,
    kind: connection.kind,
    displayName: connection.displayName,
    description: catalogEntry?.description ?? "",
    status: connection.status,
    externalAccountId: connection.externalAccountId,
    externalAccountLabel: connection.externalAccountLabel,
    config: parseConfig(connection.configJson),
    grantedScopes: getEffectiveScopes(connection),
    availableScopes: catalogEntry?.availableScopes ?? [],
    hasAccessToken: Boolean(connection.accessToken),
    hasRefreshToken: Boolean(connection.refreshToken),
    tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
    lastCheckedAt: connection.lastCheckedAt?.toISOString() ?? null,
    lastError: connection.lastError,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  };
}

async function ensureConnection(provider: IntegrationProvider) {
  await ensureSeedData();
  const existing = await db.integrationConnection.findUnique({ where: { provider } });
  if (existing) return decryptConnection(existing);
  const meta = CATALOG[provider];
  return db.integrationConnection.create({
    data: {
      provider,
      kind: meta.kind,
      displayName: meta.displayName,
      status: "disconnected",
      configJson: mergeConfigWithScopes(null, meta.defaultScopes),
    },
  });
}

function applyAdapterResult(input: AdapterConnectResult) {
  return {
    status: input.status,
    externalAccountId: input.externalAccountId ?? null,
    externalAccountLabel: input.externalAccountLabel ?? null,
    configJson: input.config ? JSON.stringify(input.config) : undefined,
    accessToken: input.secrets?.accessToken,
    refreshToken: input.secrets?.refreshToken,
    tokenExpiresAt: input.secrets?.tokenExpiresAt,
    lastError: input.lastError ?? null,
    lastCheckedAt: new Date(),
  };
}

export async function listIntegrationConnections() {
  await ensureSeedData();
  const rows = await db.integrationConnection.findMany({
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => toPublic(decryptConnection(row)));
}

export async function getIntegrationConnection(provider: IntegrationProvider) {
  const row = await ensureConnection(provider);
  return toPublic(row);
}

export async function connectIntegration<P extends IntegrationProvider>(
  provider: P,
  input: ConnectInputByProvider[P],
) {
  const existing = await ensureConnection(provider);
  const adapter = integrationAdapters[provider];
  try {
    const result = await adapter.connect(input, existing);
    const currentScopes = getEffectiveScopes(existing);
    const mergedConfig = mergeConfigWithScopes(
      result.config ? JSON.stringify(result.config) : existing.configJson,
      currentScopes.length ? currentScopes : CATALOG[provider].defaultScopes,
    );
    const writeData = {
      ...applyAdapterResult(result),
      kind: CATALOG[provider].kind,
      displayName: CATALOG[provider].displayName,
      configJson: mergedConfig,
    };
    const updated = await db.integrationConnection.update({
      where: { provider },
      data: encryptConnectionFields(writeData),
    });
    await db.auditEvent.create({
      data: {
        actor: "api:integrations",
        action: "integration_connected",
        details: provider,
      },
    });
    return {
      ...toPublic(decryptConnection(updated)),
      authorizeUrl: result.authorizeUrl ?? null,
      message: result.message ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Integration connect failed";
    await db.integrationConnection.update({
      where: { provider },
      data: {
        status: "error",
        lastError: message,
        lastCheckedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function disconnectIntegration(provider: IntegrationProvider) {
  await ensureConnection(provider);
  const updated = await db.integrationConnection.update({
    where: { provider },
    data: {
      status: "disconnected",
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      externalAccountId: null,
      externalAccountLabel: null,
      configJson: null,
      lastError: null,
      lastCheckedAt: new Date(),
    },
  });
  await db.auditEvent.create({
    data: {
      actor: "api:integrations",
      action: "integration_disconnected",
      details: provider,
    },
  });
  return toPublic(updated);
}

export async function testIntegration(provider: IntegrationProvider) {
  const existing = await ensureConnection(provider);
  const adapter = integrationAdapters[provider];
  const health = await adapter.health(existing);
  const writeData = {
    status: health.status,
    lastError: health.lastError ?? null,
    lastCheckedAt: health.checkedAt,
    externalAccountLabel: health.externalAccountLabel ?? existing.externalAccountLabel,
    accessToken: health.secrets?.accessToken ?? existing.accessToken,
    refreshToken: health.secrets?.refreshToken ?? existing.refreshToken,
    tokenExpiresAt: health.secrets?.tokenExpiresAt ?? existing.tokenExpiresAt,
  };
  const updated = await db.integrationConnection.update({
    where: { provider },
    data: encryptConnectionFields(writeData),
  });
  return toPublic(decryptConnection(updated));
}

export function isIntegrationProvider(value: string): value is IntegrationProvider {
  return value in CATALOG;
}

export function castConnectInput(provider: IntegrationProvider, input: AnyConnectInput) {
  return input as ConnectInputByProvider[typeof provider];
}

export async function setIntegrationError(provider: IntegrationProvider, message: string) {
  await ensureConnection(provider);
  const updated = await db.integrationConnection.update({
    where: { provider },
    data: {
      status: "error",
      lastError: message,
      lastCheckedAt: new Date(),
    },
  });
  return toPublic(updated);
}

export async function updateIntegrationScopes(
  provider: IntegrationProvider,
  scopes: IntegrationScope[],
) {
  const catalogEntry = CATALOG[provider];
  const validated = scopes.filter((s) => catalogEntry.availableScopes.includes(s));
  const existing = await ensureConnection(provider);
  const writeData = {
    configJson: mergeConfigWithScopes(existing.configJson, validated),
  };
  const updated = await db.integrationConnection.update({
    where: { provider },
    data: encryptConnectionFields(writeData),
  });
  await db.auditEvent.create({
    data: {
      actor: "api:integrations",
      action: "integration_scopes_updated",
      details: `${provider}: ${validated.join(", ")}`,
    },
  });
  return toPublic(decryptConnection(updated));
}

export function getCatalogEntry(provider: IntegrationProvider) {
  return CATALOG[provider];
}
