import { fetchUrlTool } from "@/lib/tools/fetch-url";
import { googleCalendarEventsTool } from "@/lib/tools/google-calendar";
import { mapsTool } from "@/lib/tools/maps";
import { opentableTool } from "@/lib/tools/opentable";
import { weatherContextTool } from "@/lib/tools/weather";
import { getIntegrationConnection } from "@/lib/repositories/integrations";
import { toOpenRouterToolSpec, type ChatToolDefinition } from "@/lib/tools/types";
import type { IntegrationScope } from "@/lib/integrations/types";

const TOOLS: ChatToolDefinition[] = [
  weatherContextTool,
  googleCalendarEventsTool,
  opentableTool,
  mapsTool,
  fetchUrlTool,
];

export function registerTool(tool: ChatToolDefinition) {
  if (!TOOLS.find((t) => t.name === tool.name)) {
    TOOLS.push(tool);
  }
}

export function getChatTools() {
  return TOOLS;
}

export async function getScopedOpenRouterTools() {
  const specs = [];
  for (const tool of TOOLS) {
    if (tool.integration && tool.operationScopes) {
      let grantedScopes: IntegrationScope[] = [];
      try {
        const conn = await getIntegrationConnection(tool.integration);
        if (conn.status === "connected") {
          grantedScopes = conn.grantedScopes as IntegrationScope[];
        }
      } catch {
        // integration not connected — skip scope filtering, guard will catch at runtime
      }

      if (grantedScopes.length > 0) {
        const allowedOps = Object.entries(tool.operationScopes)
          .filter(([, scope]) => grantedScopes.includes(scope))
          .map(([op]) => op);

        if (allowedOps.length === 0) continue;

        const scopeNote = `Allowed operations: ${allowedOps.join(", ")}.`;
        const scopedTool: ChatToolDefinition = {
          ...tool,
          description: `${tool.description} ${scopeNote}`,
        };
        specs.push(toOpenRouterToolSpec(scopedTool));
        continue;
      }
    }
    specs.push(toOpenRouterToolSpec(tool));
  }
  return specs;
}

export function getOpenRouterTools() {
  return TOOLS.map(toOpenRouterToolSpec);
}

export function getChatToolByName(name: string) {
  return TOOLS.find((tool) => tool.name === name) ?? null;
}
