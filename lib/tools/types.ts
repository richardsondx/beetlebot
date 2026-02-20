import type { IntegrationProvider, IntegrationScope } from "@/lib/integrations/types";

export type ChatToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  integration?: IntegrationProvider;
  operationScopes?: Record<string, IntegrationScope>;
  execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

export type OpenRouterToolSpec = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export function toOpenRouterToolSpec(tool: ChatToolDefinition): OpenRouterToolSpec {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
