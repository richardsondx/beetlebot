import { getIntegrationConnection } from "@/lib/repositories/integrations";
import type { IntegrationProvider, IntegrationScope } from "@/lib/integrations/types";

export async function assertIntegrationScope(
  provider: IntegrationProvider,
  scope: IntegrationScope,
): Promise<void> {
  const connection = await getIntegrationConnection(provider);
  if (connection.status !== "connected") {
    throw new Error(`${provider} integration is not connected.`);
  }
  const granted = connection.grantedScopes as IntegrationScope[];
  if (!granted.includes(scope)) {
    throw new Error(
      `${provider} does not have "${scope}" permission. ` +
        `Go to Settings → Integrations to grant it.`,
    );
  }
}
