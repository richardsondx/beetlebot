export type IntegrationScope = "read" | "write" | "delete";

export type IntegrationProvider =
  | "telegram"
  | "whatsapp"
  | "google_calendar"
  | "weather"
  | "opentable";

export type IntegrationKind = "channel" | "calendar" | "context" | "reservation";

export type IntegrationStatus = "disconnected" | "pending" | "connected" | "error";

export type IntegrationCatalogItem = {
  provider: IntegrationProvider;
  kind: IntegrationKind;
  displayName: string;
  description: string;
  availableScopes: IntegrationScope[];
  defaultScopes: IntegrationScope[];
};

export type ConnectInputByProvider = {
  telegram: {
    botToken: string;
    webhookUrl?: string;
  };
  whatsapp: {
    accessToken: string;
    phoneNumberId: string;
    businessAccountId?: string;
  };
  google_calendar: {
    code?: string;
    redirectUri?: string;
    state?: string;
    calendarId?: string;
    clientId?: string;
    clientSecret?: string;
  };
  weather: {
    weatherProvider: "open_meteo";
    apiKey?: string;
    defaultLocation?: string;
    units?: "metric" | "imperial";
  };
  opentable: {
    defaultCity?: string;
    defaultPartySize?: number;
  };
};

export type AnyConnectInput = ConnectInputByProvider[IntegrationProvider];

export type IntegrationSecretPatch = {
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
};

export type AdapterConnectResult = {
  status: IntegrationStatus;
  externalAccountId?: string;
  externalAccountLabel?: string;
  config?: Record<string, string>;
  secrets?: IntegrationSecretPatch;
  lastError?: string | null;
  authorizeUrl?: string;
  message?: string;
};

export type AdapterHealthResult = {
  status: IntegrationStatus;
  lastError?: string | null;
  checkedAt: Date;
  externalAccountLabel?: string;
  secrets?: IntegrationSecretPatch;
};
