import { IntegrationCard } from "@/components/integrations/integration-card";
import { OauthResultBanner } from "@/components/integrations/oauth-result-banner";
import { SafetySettingsCard } from "@/components/safety-settings";
import { ProfileCard } from "@/components/settings/profile-card";
import { listIntegrationConnections } from "@/lib/repositories/integrations";
import { getSafetySettings } from "@/lib/repositories/settings";
import { Suspense } from "react";

const showDebug = process.env.BEETLEBOT_DEBUG !== "false";

export default async function SettingsPage() {
  const [integrations, safetySettings] = await Promise.all([
    listIntegrationConnections(),
    getSafetySettings(),
  ]);
  const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.BEETLEBOT_BASE_URL?.trim();
  const whatsAppVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-[640px] space-y-6 px-4 py-8 md:px-8">
        <header>
          <h1 className="text-2xl font-semibold leading-8 text-[#1C1B19]">Settings</h1>
          <p className="mt-1 text-[13px] leading-[18px] text-[#6B6862]">
            Manage approvals, connections, and advanced options.
          </p>
        </header>

        <ProfileCard />

        <section className="space-y-4">
          <h2 className="text-[13px] font-semibold uppercase leading-[18px] tracking-[0.04em] text-[#6B6862]">
            Planning
          </h2>
          <SafetySettingsCard initial={safetySettings} />
        </section>

        <section className="rounded-2xl border border-[#E7E5E0] bg-white p-4">
          <h2 className="text-sm font-semibold text-[#1C1B19]">Model</h2>
          <div className="mt-3 flex items-center justify-between gap-4">
            <span className="text-sm text-[#6B6862]">Model</span>
            <span className="text-sm font-medium text-[#1C1B19]">Muse Spark (meta/muse-spark-1.3)</span>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E7E5E0] bg-white p-4">
          <h2 className="text-sm font-semibold text-[#1C1B19]">Developer</h2>
          <p className="mt-2 text-sm text-[#6B6862]">
            {showDebug
              ? "Debug tools are visible. Set BEETLEBOT_DEBUG=false to hide them."
              : "Debug tools are hidden (BEETLEBOT_DEBUG=false)."}
          </p>
          <p className="mt-2 text-sm text-[#6B6862]">Builder console: Enabled · Tool call traces: Enabled · Environment: Local development</p>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1C1B19]">Integrations</h2>
            <p className="mt-0.5 text-sm text-[#6B6862]">
              Connect services so Beetlebot can message, schedule, and plan from chat.
            </p>
          </div>

          <Suspense fallback={null}>
            <OauthResultBanner />
          </Suspense>

          <div className="grid gap-4 sm:grid-cols-2">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.provider}
                publicBaseUrl={publicBaseUrl}
                whatsAppVerifyToken={whatsAppVerifyToken}
                integration={integration as Parameters<typeof IntegrationCard>[0]["integration"]}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
