import { IntegrationConnection } from "@prisma/client";
import {
  AdapterConnectResult,
  AdapterHealthResult,
  ConnectInputByProvider,
  IntegrationProvider,
  IntegrationSecretPatch,
} from "@/lib/integrations/types";

type ExistingConnection = Pick<
  IntegrationConnection,
  | "provider"
  | "configJson"
  | "accessToken"
  | "refreshToken"
  | "tokenExpiresAt"
  | "externalAccountId"
  | "externalAccountLabel"
>;

export type IntegrationAdapter<P extends IntegrationProvider> = {
  connect: (
    input: ConnectInputByProvider[P],
    existing?: ExistingConnection | null,
  ) => Promise<AdapterConnectResult>;
  health: (existing: ExistingConnection) => Promise<AdapterHealthResult>;
};

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";

function toBase64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function parseConfig(configJson?: string | null) {
  if (!configJson) return {};
  try {
    return JSON.parse(configJson) as Record<string, string>;
  } catch {
    return {};
  }
}

async function parseJsonResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!response.ok) {
    const nestedError = payload?.error as
      | string
      | { message?: string; status?: string; code?: number }
      | undefined;
    const nestedErrorMessage =
      typeof nestedError === "string"
        ? nestedError
        : nestedError?.message;
    const message = String(
      payload?.error_description ??
        payload?.message ??
        nestedErrorMessage ??
        response.statusText,
    );
    throw new Error(message);
  }
  return payload ?? {};
}

const telegramAdapter: IntegrationAdapter<"telegram"> = {
  async connect(input) {
    const token = input.botToken.trim();
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; description?: string; result?: { id?: number; username?: string; first_name?: string } }
      | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.description ?? "Telegram validation failed");
    }
    const username = payload.result?.username ?? payload.result?.first_name ?? "Telegram Bot";
    const webhookUrl = input.webhookUrl?.trim();
    let webhookNote: string | undefined;
    if (webhookUrl) {
      const webhookResponse = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const webhookPayload = (await webhookResponse.json().catch(() => null)) as
        | { ok?: boolean; description?: string }
        | null;
      if (!webhookResponse.ok || !webhookPayload?.ok) {
        throw new Error(webhookPayload?.description ?? "Failed to register Telegram webhook");
      }
      webhookNote = `Webhook registered at ${webhookUrl}`;
    } else {
      webhookNote = "Bot connected, but no HTTPS webhook URL was available for incoming updates.";
    }
    return {
      status: "connected",
      externalAccountId: payload.result?.id ? String(payload.result.id) : undefined,
      externalAccountLabel: username,
      secrets: { accessToken: token },
      config: { botUsername: username, ...(webhookUrl ? { webhookUrl } : {}) },
      lastError: null,
      message: webhookNote,
    };
  },
  async health(existing) {
    const token = existing.accessToken;
    if (!token) {
      return { status: "error", lastError: "Missing Telegram bot token", checkedAt: new Date() };
    }
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; description?: string; result?: { username?: string; first_name?: string } }
        | null;
      if (!response.ok || !payload?.ok) {
        return {
          status: "error",
          lastError: payload?.description ?? "Telegram health check failed",
          checkedAt: new Date(),
        };
      }
      return {
        status: "connected",
        checkedAt: new Date(),
        lastError: null,
        externalAccountLabel: payload.result?.username ?? payload.result?.first_name,
      };
    } catch (error) {
      return {
        status: "error",
        lastError: error instanceof Error ? error.message : "Telegram health check failed",
        checkedAt: new Date(),
      };
    }
  },
};

const whatsappAdapter: IntegrationAdapter<"whatsapp"> = {
  async connect(input) {
    const token = input.accessToken.trim();
    const phoneNumberId = input.phoneNumberId.trim();
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? "v22.0";
    const response = await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}?fields=id,display_phone_number,verified_name`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const payload = await parseJsonResponse(response);
    const displayPhone = String(payload.display_phone_number ?? phoneNumberId);
    return {
      status: "connected",
      externalAccountId: phoneNumberId,
      externalAccountLabel: displayPhone,
      config: {
        phoneNumberId,
        ...(input.businessAccountId ? { businessAccountId: input.businessAccountId.trim() } : {}),
        verifiedName: String(payload.verified_name ?? ""),
      },
      secrets: { accessToken: token },
      lastError: null,
    };
  },
  async health(existing) {
    const config = parseConfig(existing.configJson);
    const phoneNumberId = config.phoneNumberId;
    if (!existing.accessToken || !phoneNumberId) {
      return { status: "error", lastError: "Missing WhatsApp credentials", checkedAt: new Date() };
    }
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? "v22.0";
    try {
      const response = await fetch(
        `https://graph.facebook.com/${graphVersion}/${phoneNumberId}?fields=id,display_phone_number,verified_name`,
        {
          headers: { Authorization: `Bearer ${existing.accessToken}` },
        },
      );
      const payload = await parseJsonResponse(response);
      return {
        status: "connected",
        checkedAt: new Date(),
        lastError: null,
        externalAccountLabel: String(payload.display_phone_number ?? phoneNumberId),
      };
    } catch (error) {
      return {
        status: "error",
        checkedAt: new Date(),
        lastError: error instanceof Error ? error.message : "WhatsApp health check failed",
      };
    }
  },
};

type OpenMeteoGeoHit = {
  latitude?: number;
  longitude?: number;
  name?: string;
  country?: string;
};

async function resolveOpenMeteoLocation(input: string) {
  const trimmed = input.trim();
  const latLonMatch = trimmed.match(
    /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/,
  );
  if (latLonMatch) {
    const latitude = Number(latLonMatch[1]);
    const longitude = Number(latLonMatch[2]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("Invalid weather location coordinates.");
    }
    return {
      latitude,
      longitude,
      label: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    };
  }

  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({
      name: trimmed,
      count: "1",
      language: "en",
      format: "json",
    }).toString()}`,
  );
  const payload = (await parseJsonResponse(response)) as {
    results?: OpenMeteoGeoHit[];
  };
  const first = payload.results?.[0];
  if (!first || typeof first.latitude !== "number" || typeof first.longitude !== "number") {
    throw new Error("Could not resolve weather location.");
  }
  return {
    latitude: first.latitude,
    longitude: first.longitude,
    label: [first.name, first.country].filter(Boolean).join(", "),
  };
}

const weatherAdapter: IntegrationAdapter<"weather"> = {
  async connect(input, existing) {
    const provider = input.weatherProvider ?? "open_meteo";
    if (provider !== "open_meteo") {
      throw new Error(`Unsupported weather provider: ${provider}`);
    }

    const previousConfig = parseConfig(existing?.configJson);
    const defaultLocation = input.defaultLocation?.trim() || previousConfig.defaultLocation;
    const units = input.units ?? (previousConfig.units as "metric" | "imperial" | undefined) ?? "metric";

    let locationConfig: Record<string, string> = {};
    if (defaultLocation) {
      const resolved = await resolveOpenMeteoLocation(defaultLocation);
      locationConfig = {
        defaultLocation,
        latitude: String(resolved.latitude),
        longitude: String(resolved.longitude),
        locationLabel: resolved.label || defaultLocation,
      };
    }

    return {
      status: "connected",
      externalAccountId: provider,
      externalAccountLabel: locationConfig.locationLabel ?? previousConfig.locationLabel ?? "Weather context",
      config: {
        weatherProvider: provider,
        units,
        ...locationConfig,
      },
      secrets: {
        // Open-Meteo does not require an API key. Keep the shape extensible for future providers.
        accessToken: input.apiKey?.trim() || null,
      },
      lastError: null,
    };
  },
  async health(existing) {
    const config = parseConfig(existing.configJson);
    const provider = config.weatherProvider ?? "open_meteo";
    if (provider !== "open_meteo") {
      return {
        status: "error",
        lastError: `Unsupported weather provider: ${provider}`,
        checkedAt: new Date(),
      };
    }

    const latitude = Number(config.latitude ?? "43.6532");
    const longitude = Number(config.longitude ?? "-79.3832");
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return {
        status: "error",
        lastError: "Weather integration has invalid coordinates",
        checkedAt: new Date(),
      };
    }

    const units = config.units === "imperial" ? "fahrenheit" : "celsius";
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          current: "temperature_2m,precipitation_probability,weather_code",
          temperature_unit: units,
        }).toString()}`,
      );
      await parseJsonResponse(response);
      return {
        status: "connected",
        checkedAt: new Date(),
        lastError: null,
        externalAccountLabel: config.locationLabel ?? existing.externalAccountLabel ?? "Weather context",
      };
    } catch (error) {
      return {
        status: "error",
        checkedAt: new Date(),
        lastError: error instanceof Error ? error.message : "Weather health check failed",
      };
    }
  },
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<IntegrationSecretPatch> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const payload = (await parseJsonResponse(response)) as GoogleTokenResponse;
  if (!payload.access_token) throw new Error("Google token refresh did not return an access token");
  return {
    accessToken: payload.access_token,
    tokenExpiresAt: payload.expires_in
      ? new Date(Date.now() + Number(payload.expires_in) * 1000)
      : null,
  };
}

const googleCalendarAdapter: IntegrationAdapter<"google_calendar"> = {
  async connect(input, existing) {
    const existingConfig = parseConfig(existing?.configJson);
    const clientId = input.clientId?.trim() || existingConfig.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = input.clientSecret?.trim() || existingConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = input.redirectUri?.trim() || existingConfig.redirectUri || process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Missing Google OAuth config. Set GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI.");
    }

    if (!input.code) {
      const rawState = JSON.stringify({
        provider: "google_calendar",
        returnTo: "/settings",
        at: Date.now(),
      });
      const state = input.state?.trim() || toBase64Url(rawState);
      const authorizeUrl = `${GOOGLE_AUTH_BASE}?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        scope: "https://www.googleapis.com/auth/calendar",
        state,
      }).toString()}`;
      return {
        status: "pending",
        authorizeUrl,
        config: { clientId, clientSecret, redirectUri } as Record<string, string>,
        message: "Redirecting to Google for authorization.",
      };
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: input.code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
    const tokenPayload = (await parseJsonResponse(tokenResponse)) as GoogleTokenResponse;
    const accessToken = tokenPayload.access_token;
    if (!accessToken) throw new Error("Google OAuth exchange did not return an access token");

    const calendarsResponse = await fetch(GOOGLE_CALENDAR_LIST_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const calendarsPayload = (await parseJsonResponse(calendarsResponse)) as {
      items?: Array<{ id?: string; summary?: string; primary?: boolean }>;
    };
    const chosenCalendar =
      calendarsPayload.items?.find((item) => item.id === input.calendarId) ||
      calendarsPayload.items?.find((item) => item.primary) ||
      calendarsPayload.items?.[0];

    const previousConfig = parseConfig(existing?.configJson);
    return {
      status: "connected",
      externalAccountId: chosenCalendar?.id ?? previousConfig.calendarId ?? "primary",
      externalAccountLabel: chosenCalendar?.summary ?? "Google Calendar",
      config: {
        calendarId: chosenCalendar?.id ?? previousConfig.calendarId ?? "primary",
        calendarName: chosenCalendar?.summary ?? "Google Calendar",
        clientId,
        clientSecret,
        redirectUri,
      },
      secrets: {
        accessToken,
        refreshToken: tokenPayload.refresh_token ?? existing?.refreshToken ?? null,
        tokenExpiresAt: tokenPayload.expires_in
          ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000)
          : null,
      },
      lastError: null,
    };
  },
  async health(existing) {
    const config = parseConfig(existing.configJson);
    const clientId = config.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = config.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = existing.refreshToken;
    let accessToken = existing.accessToken;
    let secrets: IntegrationSecretPatch | undefined;

    if (!accessToken && refreshToken && clientId && clientSecret) {
      secrets = await refreshGoogleAccessToken(refreshToken, clientId, clientSecret);
      accessToken = secrets.accessToken ?? null;
    }
    if (!accessToken) {
      return { status: "error", lastError: "Missing Google access token", checkedAt: new Date() };
    }

    try {
      let response = await fetch(GOOGLE_CALENDAR_LIST_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 401 && refreshToken && clientId && clientSecret) {
        secrets = await refreshGoogleAccessToken(refreshToken, clientId, clientSecret);
        accessToken = secrets.accessToken ?? accessToken;
        response = await fetch(GOOGLE_CALENDAR_LIST_URL, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
      const payload = (await parseJsonResponse(response)) as {
        items?: Array<{ id?: string; summary?: string; primary?: boolean }>;
      };
      const primary = payload.items?.find((item) => item.primary) || payload.items?.[0];
      return {
        status: "connected",
        checkedAt: new Date(),
        lastError: null,
        externalAccountLabel: primary?.summary ?? existing.externalAccountLabel ?? "Google Calendar",
        secrets,
      };
    } catch (error) {
      return {
        status: "error",
        checkedAt: new Date(),
        lastError: error instanceof Error ? error.message : "Google Calendar health check failed",
      };
    }
  },
};

const OPENROUTESERVICE_DIRECTIONS_URL =
  "https://api.openrouteservice.org/v2/directions/driving-car";

const mapsAdapter: IntegrationAdapter<"maps"> = {
  async connect(input, existing) {
    const previousConfig = parseConfig(existing?.configJson);
    const mapsProvider = input.mapsProvider ?? (previousConfig.mapsProvider as string) ?? "approx";
    if (mapsProvider !== "approx" && mapsProvider !== "openrouteservice") {
      throw new Error(`Unsupported maps provider: ${mapsProvider}`);
    }

    const units =
      input.units ??
      ((previousConfig.units as "metric" | "imperial" | undefined) ?? "metric");

    const defaultLocation =
      input.defaultLocation?.trim() || (previousConfig.defaultLocation as string | undefined);

    let locationConfig: Record<string, string> = {};
    if (defaultLocation) {
      const resolved = await resolveOpenMeteoLocation(defaultLocation);
      locationConfig = {
        defaultLocation,
        latitude: String(resolved.latitude),
        longitude: String(resolved.longitude),
        locationLabel: resolved.label || defaultLocation,
      };
    }

    const apiKey = input.apiKey?.trim() || existing?.accessToken || null;
    if (mapsProvider === "openrouteservice" && !apiKey) {
      throw new Error(
        "Missing OpenRouteService API key. Create a free key at openrouteservice.org and paste it here.",
      );
    }

    return {
      status: "connected",
      externalAccountId: mapsProvider,
      externalAccountLabel:
        mapsProvider === "openrouteservice" ? "OpenRouteService" : "Maps (Approx)",
      config: {
        mapsProvider,
        units,
        ...locationConfig,
      },
      secrets:
        mapsProvider === "openrouteservice"
          ? { accessToken: apiKey }
          : { accessToken: null },
      lastError: null,
    };
  },
  async health(existing) {
    const config = parseConfig(existing.configJson);
    const mapsProvider = (config.mapsProvider as string) ?? "approx";
    if (mapsProvider !== "openrouteservice") {
      return {
        status: "connected",
        checkedAt: new Date(),
        lastError: null,
        externalAccountLabel: "Maps (Approx)",
      };
    }

    const token = existing.accessToken;
    if (!token) {
      return {
        status: "error",
        lastError: "Missing OpenRouteService API key",
        checkedAt: new Date(),
      };
    }

    try {
      const response = await fetch(
        `${OPENROUTESERVICE_DIRECTIONS_URL}?${new URLSearchParams({
          start: "8.681495,49.41461",
          end: "8.687872,49.420318",
        }).toString()}`,
        { headers: { Authorization: token } },
      );
      await parseJsonResponse(response);
      return {
        status: "connected",
        checkedAt: new Date(),
        lastError: null,
        externalAccountLabel: "OpenRouteService",
      };
    } catch (error) {
      return {
        status: "error",
        checkedAt: new Date(),
        lastError: error instanceof Error ? error.message : "Maps health check failed",
      };
    }
  },
};

const opentableAdapter: IntegrationAdapter<"opentable"> = {
  async connect(input) {
    const defaultCity = input.defaultCity?.trim() || "Toronto";
    const defaultPartySize = input.defaultPartySize ?? 2;

    return {
      status: "connected",
      externalAccountId: "opentable",
      externalAccountLabel: `OpenTable (${defaultCity})`,
      config: {
        defaultCity,
        defaultPartySize: String(defaultPartySize),
      },
      lastError: null,
    };
  },
  async health(existing) {
    const config = parseConfig(existing.configJson);
    try {
      const response = await fetch(
        `https://www.opentable.com/s?term=${encodeURIComponent(config.defaultCity || "Toronto")}`,
        { method: "HEAD" },
      );
      if (!response.ok && response.status !== 301 && response.status !== 302) {
        return {
          status: "error",
          lastError: `OpenTable returned status ${response.status}`,
          checkedAt: new Date(),
        };
      }
      return {
        status: "connected",
        checkedAt: new Date(),
        lastError: null,
        externalAccountLabel: `OpenTable (${config.defaultCity || "OpenTable"})`,
      };
    } catch (error) {
      return {
        status: "error",
        checkedAt: new Date(),
        lastError: error instanceof Error ? error.message : "OpenTable health check failed",
      };
    }
  },
};

export const integrationAdapters: {
  [P in IntegrationProvider]: IntegrationAdapter<P>;
} = {
  telegram: telegramAdapter,
  whatsapp: whatsappAdapter,
  google_calendar: googleCalendarAdapter,
  weather: weatherAdapter,
  maps: mapsAdapter,
  opentable: opentableAdapter,
};
