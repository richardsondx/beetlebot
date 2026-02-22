import { IntegrationCard } from "@/components/integrations/integration-card";
import { OauthResultBanner } from "@/components/integrations/oauth-result-banner";
import { SafetySettingsCard } from "@/components/safety-settings";
import { listIntegrationConnections } from "@/lib/repositories/integrations";
import { getSafetySettings } from "@/lib/repositories/settings";
import { Suspense } from "react";

const advancedItems = [
  { label: "Builder console", value: "Enabled" },
  { label: "Tool call traces", value: "Enabled" },
  { label: "Environment", value: "Local development" },
];

export default async function SettingsPage() {
  const [integrations, safetySettings] = await Promise.all([
    listIntegrationConnections(),
    getSafetySettings(),
  ]);
  const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.BEETLEBOT_BASE_URL?.trim();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-6">
        <header>
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-300/10 text-lg">
              ⚙️
            </span>
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>
          <p className="text-sm text-slate-400">Manage approvals, connections, and advanced options.</p>
        </header>

        {/* Preferences */}
        <div className="grid gap-4 sm:grid-cols-2">
          <SafetySettingsCard initial={safetySettings} />

          <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-300/10 text-sm">
                🔧
              </span>
              <h2 className="text-sm font-semibold text-slate-100">Advanced</h2>
            </div>
            <div className="space-y-3">
              {advancedItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-400">{item.label}</span>
                  <span className="rounded-md border border-amber-300/15 bg-amber-300/8 px-2.5 py-1 text-xs text-amber-200">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-600">
              Disable via <code className="font-mono">BEETLEBOT_DEBUG=false</code>
            </p>
          </section>
        </div>

        {/* Integrations */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Integrations</h2>
            <p className="mt-0.5 text-sm text-slate-400">
              Connect services so beetlebot can message, schedule, and plan from chat.
            </p>
          </div>

          <Suspense fallback={null}>
            <OauthResultBanner />
          </Suspense>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.provider}
                publicBaseUrl={publicBaseUrl}
                integration={integration as Parameters<typeof IntegrationCard>[0]["integration"]}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
