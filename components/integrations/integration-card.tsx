"use client";

import { FormEvent, useState } from "react";

type IntegrationScope = "read" | "write" | "delete";

type IntegrationConnection = {
  provider: string;
  kind: string;
  displayName: string | null;
  description: string;
  status: string;
  config?: Record<string, string>;
  externalAccountLabel: string | null;
  externalAccountId: string | null;
  lastError: string | null;
  lastCheckedAt: string | null;
  hasAccessToken: boolean;
  grantedScopes: IntegrationScope[];
  availableScopes: IntegrationScope[];
};

type ApiResponse = IntegrationConnection & {
  authorizeUrl?: string | null;
  message?: string | null;
};

type ApiEnvelope<T> = { data?: T; error?: string };

const STATUS_STYLES: Record<string, string> = {
  connected: "bg-emerald-300/20 text-emerald-100",
  disconnected: "bg-slate-400/20 text-slate-100",
  pending: "bg-amber-300/20 text-amber-100",
  error: "bg-rose-300/20 text-rose-100",
};

function normalizeBaseUrl(value?: string) {
  return value?.trim().replace(/\/+$/, "");
}

function redactUrl(value: string) {
  try {
    const url = new URL(value);
    const maskedHost = "•".repeat(url.host.length);
    return `${url.protocol}//${maskedHost}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "•".repeat(Math.max(12, Math.min(value.length, 64)));
  }
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
      />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 4.5 21 19.5M9.6 6.16A9.66 9.66 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a18.67 18.67 0 0 1-3.16 3.84M14.8 14.33A3.2 3.2 0 0 1 9.67 9.2M6.14 11.01A18.27 18.27 0 0 0 2.5 12s3.5 6.5 9.5 6.5a9.5 9.5 0 0 0 4.26-.98"
      />
    </svg>
  );
}

async function api<T>(
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: Record<string, unknown>,
) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok) throw new Error(payload.error ?? "Request failed");
  return payload.data as T;
}

// ── Reusable form primitives ────────────────────────────────────────────

function CopyableField({
  label,
  value,
  defaultRevealed = false,
}: {
  label: string;
  value: string;
  defaultRevealed?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(defaultRevealed);
  const displayValue = revealed ? value : redactUrl(value);

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            readOnly
            value={displayValue}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-10 font-mono text-xs text-slate-200 focus:border-teal-400/50 focus:outline-none focus:ring-1 focus:ring-teal-400/30"
          />
          <button
            type="button"
            onClick={() => setRevealed((prev) => !prev)}
            className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
            aria-label={revealed ? "Hide URL" : "Show URL"}
            title={revealed ? "Hide URL" : "Show URL"}
          >
            {revealed ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-white/10"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = true,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-slate-400">
        {label}
        {!required && <span className="ml-1 text-slate-600">(optional)</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-teal-400/50 focus:outline-none focus:ring-1 focus:ring-teal-400/30"
      />
    </div>
  );
}

function SetupSteps({
  steps,
  link,
  linkLabel,
}: {
  steps: string[];
  link?: string;
  linkLabel?: string;
}) {
  return (
    <div className="space-y-3">
      <ol className="space-y-1.5 text-xs text-slate-400">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 font-mono text-teal-400/70">
              {i + 1}.
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:bg-white/10"
        >
          {linkLabel ?? "Open"} <span aria-hidden>↗</span>
        </a>
      )}
    </div>
  );
}

function formatIsoLocalTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

// ── Provider-specific setup forms ───────────────────────────────────────

function GoogleCalendarSetup({
  onSubmit,
  loading,
  config,
  publicBaseUrl,
}: {
  onSubmit: (body: Record<string, unknown>) => void;
  loading: boolean;
  config?: Record<string, string>;
  publicBaseUrl?: string;
}) {
  const hasStoredCreds = Boolean(config?.clientId && config?.clientSecret);
  const appUrl = normalizeBaseUrl(publicBaseUrl);
  const redirectUri =
    config?.redirectUri ??
    (appUrl
      ? `${appUrl.replace(/\/+$/, "")}/api/integrations/google-calendar/callback`
      : "");

  if (hasStoredCreds) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-400">
          Google credentials are configured. Click below to authorize access.
        </p>
        <button
          type="button"
          onClick={() => onSubmit({})}
          disabled={loading}
          className="w-full rounded-lg bg-teal-500/20 px-4 py-2.5 text-sm font-medium text-teal-100 transition-colors hover:bg-teal-500/30 disabled:opacity-50"
        >
          {loading ? "Connecting…" : "Connect with Google"}
        </button>
      </div>
    );
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      clientId: (fd.get("clientId") as string) || undefined,
      clientSecret: (fd.get("clientSecret") as string) || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SetupSteps
        steps={[
          "Go to Google Cloud Console and select or create a project",
          "Search for and enable the Google Calendar API",
          "Go to Credentials → Create OAuth 2.0 Client ID (Web application)",
          "Add the Redirect URI below to your OAuth client's authorized redirect URIs",
          "Copy your Client ID and Client Secret into the fields below",
        ]}
        link="https://console.cloud.google.com/apis/credentials"
        linkLabel="Open Google Cloud Console"
      />

      {redirectUri && (
        <CopyableField
          label="Redirect URI — add this to your Google OAuth client"
          value={redirectUri}
          defaultRevealed={false}
        />
      )}

      <div className="space-y-3">
        <Field
          label="Client ID"
          name="clientId"
          placeholder="xxxxx.apps.googleusercontent.com"
          required={false}
        />
        <Field
          label="Client Secret"
          name="clientSecret"
          type="password"
          placeholder="GOCSPX-..."
          required={false}
        />
      </div>

      <p className="text-xs text-slate-600">
        Leave blank if{" "}
        <code className="font-mono text-slate-500">GOOGLE_CLIENT_ID</code> and{" "}
        <code className="font-mono text-slate-500">GOOGLE_CLIENT_SECRET</code>{" "}
        are set in your environment.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal-500/20 px-4 py-2.5 text-sm font-medium text-teal-100 transition-colors hover:bg-teal-500/30 disabled:opacity-50"
      >
        {loading ? "Connecting…" : "Save & Connect with Google"}
      </button>
    </form>
  );
}

function TelegramSetup({
  onSubmit,
  loading,
  webhookUrl,
}: {
  onSubmit: (body: Record<string, unknown>) => void;
  loading: boolean;
  webhookUrl?: string;
}) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({ botToken: fd.get("botToken") as string });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SetupSteps
        steps={[
          "Open Telegram and message @BotFather",
          "Send /newbot and follow the prompts to name your bot",
          "Copy the bot token BotFather gives you and paste it below",
          "Set NEXT_PUBLIC_APP_URL (or BEETLEBOT_BASE_URL) to a public HTTPS URL so Telegram can deliver webhooks",
        ]}
        link="https://t.me/BotFather"
        linkLabel="Open BotFather"
      />

      {webhookUrl && (
        <CopyableField
          label="Webhook URL — add this in your Telegram bot webhook setup"
          value={webhookUrl}
          defaultRevealed={false}
        />
      )}

      <Field
        label="Bot Token"
        name="botToken"
        type="password"
        placeholder="123456789:ABCdefGHIjklmnOPQrst..."
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal-500/20 px-4 py-2.5 text-sm font-medium text-teal-100 transition-colors hover:bg-teal-500/30 disabled:opacity-50"
      >
        {loading ? "Connecting…" : "Connect Telegram"}
      </button>
    </form>
  );
}

function WhatsAppSetup({
  onSubmit,
  loading,
  webhookUrl,
  verifyToken,
}: {
  onSubmit: (body: Record<string, unknown>) => void;
  loading: boolean;
  webhookUrl?: string;
  verifyToken?: string;
}) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      accessToken: fd.get("accessToken") as string,
      phoneNumberId: fd.get("phoneNumberId") as string,
      businessAccountId: (fd.get("businessAccountId") as string) || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SetupSteps
        steps={[
          "Go to Meta for Developers → your app → WhatsApp → API Setup",
          "Generate or copy your permanent access token",
          "Copy the Phone Number ID from the same page",
        ]}
        link="https://developers.facebook.com/apps/"
        linkLabel="Open Meta for Developers"
      />

      {webhookUrl && (
        <CopyableField
          label="Webhook URL — add this in your WhatsApp webhook configuration"
          value={webhookUrl}
          defaultRevealed={false}
        />
      )}
      {verifyToken ? (
        <CopyableField
          label="Verify Token — paste this exact value in Meta webhook setup"
          value={verifyToken}
          defaultRevealed={true}
        />
      ) : (
        <p className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-200">
          Set <code className="font-mono">WHATSAPP_WEBHOOK_VERIFY_TOKEN</code> in your
          environment, then restart beetlebot before verifying the webhook in Meta.
        </p>
      )}

      <div className="space-y-3">
        <Field
          label="Access Token"
          name="accessToken"
          type="password"
          placeholder="EAAx..."
        />
        <Field
          label="Phone Number ID"
          name="phoneNumberId"
          placeholder="106540352..."
        />
        <Field
          label="Business Account ID"
          name="businessAccountId"
          placeholder="103420..."
          required={false}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal-500/20 px-4 py-2.5 text-sm font-medium text-teal-100 transition-colors hover:bg-teal-500/30 disabled:opacity-50"
      >
        {loading ? "Connecting…" : "Connect WhatsApp"}
      </button>
    </form>
  );
}

function WeatherSetup({
  onSubmit,
  loading,
  config,
}: {
  onSubmit: (body: Record<string, unknown>) => void;
  loading: boolean;
  config?: Record<string, string>;
}) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      weatherProvider: "open_meteo",
      defaultLocation: (fd.get("defaultLocation") as string) || undefined,
      units: (fd.get("units") as string) || "metric",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-slate-400">
        Uses Open-Meteo for weather data — free, no API key required. Enter your
        default location for forecast-aware suggestions.
      </p>

      <div className="space-y-3">
        <Field
          label="Default Location"
          name="defaultLocation"
          placeholder="Montreal, Canada  or  45.50,-73.57"
          required={false}
          defaultValue={config?.defaultLocation}
        />
        <div>
          <label
            htmlFor="units"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Units
          </label>
          <select
            id="units"
            name="units"
            defaultValue={config?.units ?? "metric"}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-teal-400/50 focus:outline-none focus:ring-1 focus:ring-teal-400/30 [&>option]:bg-[#0d1422]"
          >
            <option value="metric">Metric (°C, km)</option>
            <option value="imperial">Imperial (°F, mi)</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal-500/20 px-4 py-2.5 text-sm font-medium text-teal-100 transition-colors hover:bg-teal-500/30 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save Weather Settings"}
      </button>
    </form>
  );
}

function MapsSetup({
  onSubmit,
  loading,
  config,
}: {
  onSubmit: (body: Record<string, unknown>) => void;
  loading: boolean;
  config?: Record<string, string>;
}) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const mapsProvider = (fd.get("mapsProvider") as string) || "approx";
    const apiKey = (fd.get("apiKey") as string) || "";
    const defaultLocation = (fd.get("defaultLocation") as string) || "";
    const units = (fd.get("units") as string) || "metric";

    onSubmit({
      mapsProvider,
      apiKey: apiKey.trim() ? apiKey.trim() : undefined,
      defaultLocation: defaultLocation.trim() ? defaultLocation.trim() : undefined,
      units,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SetupSteps
        steps={[
          "Choose Approx for free, no-key distance + ETA estimates",
          "Optionally choose OpenRouteService for more accurate routing (free per-user API key)",
          "Set a default location for travel buffers when origin isn't specified",
        ]}
        link="https://openrouteservice.org/dev/#/signup"
        linkLabel="OpenRouteService signup (optional)"
      />

      <div className="space-y-3">
        <div>
          <label
            htmlFor="mapsProvider"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Provider
          </label>
          <select
            id="mapsProvider"
            name="mapsProvider"
            defaultValue={config?.mapsProvider ?? "approx"}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-teal-400/50 focus:outline-none focus:ring-1 focus:ring-teal-400/30 [&>option]:bg-[#0d1422]"
          >
            <option value="approx">Approx (no API key)</option>
            <option value="openrouteservice">OpenRouteService (API key)</option>
          </select>
        </div>

        <Field
          label="OpenRouteService API Key"
          name="apiKey"
          type="password"
          placeholder="Optional — only needed for OpenRouteService"
          required={false}
        />

        <Field
          label="Default Location"
          name="defaultLocation"
          placeholder="Toronto  or  43.6532,-79.3832"
          required={false}
          defaultValue={config?.defaultLocation}
        />

        <div>
          <label
            htmlFor="units"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Units
          </label>
          <select
            id="units"
            name="units"
            defaultValue={config?.units ?? "metric"}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-teal-400/50 focus:outline-none focus:ring-1 focus:ring-teal-400/30 [&>option]:bg-[#0d1422]"
          >
            <option value="metric">Metric (km)</option>
            <option value="imperial">Imperial (mi)</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal-500/20 px-4 py-2.5 text-sm font-medium text-teal-100 transition-colors hover:bg-teal-500/30 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save Maps Settings"}
      </button>
    </form>
  );
}

function OpenTableSetup({
  onSubmit,
  loading,
  config,
}: {
  onSubmit: (body: Record<string, unknown>) => void;
  loading: boolean;
  config?: Record<string, string>;
}) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      defaultCity: (fd.get("defaultCity") as string) || undefined,
      defaultPartySize: Number(fd.get("defaultPartySize")) || 2,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-slate-400">
        Uses OpenTable for restaurant search and availability. Provide a default
        city to scope restaurant lookups.
      </p>

      <div className="space-y-3">
        <Field
          label="Default City"
          name="defaultCity"
          placeholder="Toronto"
          required={false}
          defaultValue={config?.defaultCity}
        />
        <Field
          label="Default Party Size"
          name="defaultPartySize"
          type="number"
          placeholder="2"
          required={false}
          defaultValue={config?.defaultPartySize ?? "2"}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal-500/20 px-4 py-2.5 text-sm font-medium text-teal-100 transition-colors hover:bg-teal-500/30 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save OpenTable Settings"}
      </button>
    </form>
  );
}

// ── Scope toggles ────────────────────────────────────────────────────────

const SCOPE_LABELS: Record<IntegrationScope, string> = {
  read: "Read",
  write: "Write",
  delete: "Delete",
};

function ScopeToggles({
  provider,
  grantedScopes,
  availableScopes,
  onUpdate,
}: {
  provider: string;
  grantedScopes: IntegrationScope[];
  availableScopes: IntegrationScope[];
  onUpdate: (scopes: IntegrationScope[]) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function toggleScope(scope: IntegrationScope) {
    const next = grantedScopes.includes(scope)
      ? grantedScopes.filter((s) => s !== scope)
      : [...grantedScopes, scope];
    setSaving(true);
    try {
      const result = await api<IntegrationConnection>(
        `/api/integrations/${provider}/scopes`,
        "PATCH",
        { scopes: next },
      );
      onUpdate(result.grantedScopes);
    } catch {
      // revert silently on error
    } finally {
      setSaving(false);
    }
  }

  if (availableScopes.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-slate-500">Permissions</p>
      <div className="flex flex-wrap gap-1.5">
        {availableScopes.map((scope) => {
          const active = grantedScopes.includes(scope);
          return (
            <button
              key={scope}
              type="button"
              disabled={saving}
              onClick={() => void toggleScope(scope)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                active
                  ? "border border-teal-400/30 bg-teal-400/15 text-teal-200"
                  : "border border-white/10 bg-white/5 text-slate-500 hover:text-slate-300"
              }`}
            >
              {SCOPE_LABELS[scope]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main card component ─────────────────────────────────────────────────

export function IntegrationCard({
  integration,
  publicBaseUrl,
  whatsAppVerifyToken,
}: {
  integration: IntegrationConnection;
  publicBaseUrl?: string;
  whatsAppVerifyToken?: string;
}) {
  const [state, setState] = useState(integration);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(
    state.status !== "connected" && state.status !== "error",
  );

  const isConnected = state.status === "connected";
  const hasSession = isConnected || state.status === "error";
  const normalizedPublicBaseUrl = normalizeBaseUrl(publicBaseUrl);
  const telegramWebhookUrl = normalizedPublicBaseUrl
    ? `${normalizedPublicBaseUrl}/api/webhooks/telegram`
    : undefined;
  const whatsAppWebhookUrl = normalizedPublicBaseUrl
    ? `${normalizedPublicBaseUrl}/api/webhooks/whatsapp`
    : undefined;
  const connectedWebhookField =
    state.provider === "telegram" && telegramWebhookUrl
      ? {
          label: "Webhook URL — add this in your Telegram bot webhook setup",
          value: telegramWebhookUrl,
        }
      : state.provider === "whatsapp" && whatsAppWebhookUrl
        ? {
            label: "Webhook URL — add this in your WhatsApp webhook configuration",
            value: whatsAppWebhookUrl,
          }
        : null;

  async function handleConnect(body: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const result = await api<ApiResponse>(
        `/api/integrations/${state.provider}/connect`,
        "POST",
        body,
      );
      if (result.authorizeUrl) {
        window.location.assign(result.authorizeUrl);
        return;
      }
      setState(result);
      setShowSetup(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    setLoading(true);
    setError(null);
    try {
      const result = await api<IntegrationConnection>(
        `/api/integrations/${state.provider}/test`,
        "POST",
      );
      setState(result);
      if (result.status !== "connected") {
        setError(result.lastError ?? "Health check failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    setError(null);
    try {
      const result = await api<IntegrationConnection>(
        `/api/integrations/${state.provider}/disconnect`,
        "POST",
      );
      setState(result);
      setShowSetup(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setLoading(false);
    }
  }

  function renderSetupForm() {
    const props = { onSubmit: handleConnect, loading };
    switch (state.provider) {
      case "google_calendar":
        return (
          <GoogleCalendarSetup
            {...props}
            config={state.config}
            publicBaseUrl={normalizedPublicBaseUrl}
          />
        );
      case "telegram":
        return <TelegramSetup {...props} webhookUrl={telegramWebhookUrl} />;
      case "whatsapp":
        return (
          <WhatsAppSetup
            {...props}
            webhookUrl={whatsAppWebhookUrl}
            verifyToken={whatsAppVerifyToken}
          />
        );
      case "weather":
        return <WeatherSetup {...props} config={state.config} />;
      case "opentable":
        return <OpenTableSetup {...props} config={state.config} />;
      case "maps":
        return <MapsSetup {...props} config={state.config} />;
      default:
        return null;
    }
  }

  return (
    <article className="flex flex-col rounded-xl border border-white/10 bg-[#0d1422] p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">
            {state.displayName ?? state.provider}
          </h3>
          <p className="mt-0.5 text-sm text-slate-400">{state.description}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            STATUS_STYLES[state.status] ?? STATUS_STYLES.disconnected
          }`}
        >
          {state.status}
        </span>
      </div>

      {/* Connected view */}
      {hasSession && !showSetup && (
        <div className="mt-4 space-y-3">
          {connectedWebhookField && (
            <CopyableField
              label={connectedWebhookField.label}
              value={connectedWebhookField.value}
              defaultRevealed={true}
            />
          )}
          {state.provider === "whatsapp" && whatsAppVerifyToken && (
            <CopyableField
              label="Verify Token — paste this exact value in Meta webhook setup"
              value={whatsAppVerifyToken}
              defaultRevealed={true}
            />
          )}
          <div className="space-y-1 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs text-slate-300">
            <p>
              <span className="text-slate-500">Account:</span>{" "}
              {state.externalAccountLabel ?? "Connected"}
            </p>
            {state.lastCheckedAt && (
              <p>
                <span className="text-slate-500">Last checked:</span>{" "}
                {formatIsoLocalTimestamp(state.lastCheckedAt)}
              </p>
            )}
          </div>

          <ScopeToggles
            provider={state.provider}
            grantedScopes={state.grantedScopes}
            availableScopes={state.availableScopes}
            onUpdate={(scopes) =>
              setState((prev) => ({ ...prev, grantedScopes: scopes }))
            }
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={loading}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {loading ? "Testing…" : "Test"}
            </button>
            <button
              type="button"
              onClick={() => setShowSetup(true)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:bg-white/10"
            >
              Reconnect
            </button>
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={loading}
              className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-xs text-rose-200 transition-colors hover:bg-rose-300/20 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Setup form */}
      {(!hasSession || showSetup) && (
        <div className="mt-4 border-t border-white/5 pt-4">
          {hasSession && (
            <button
              type="button"
              onClick={() => setShowSetup(false)}
              className="mb-3 text-xs text-slate-500 transition-colors hover:text-slate-300"
            >
              ← Back to connection info
            </button>
          )}
          {renderSetupForm()}
        </div>
      )}

      {/* Errors */}
      {(error || (!isConnected && state.lastError)) && (
        <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/5 px-3 py-2 text-xs text-rose-300">
          {error || state.lastError}
        </div>
      )}
    </article>
  );
}
