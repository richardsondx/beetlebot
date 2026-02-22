import { getWeatherContext } from "@/lib/weather/service";
import { assertIntegrationScope } from "@/lib/integrations/scope-guard";
import type { ChatToolDefinition } from "@/lib/tools/types";

export const weatherContextTool: ChatToolDefinition = {
  name: "get_weather_context",
  integration: "weather",
  operationScopes: { forecast: "read" },
  description:
    "Get weather context for a location, including current conditions plus hourly and weekly forecast signals for planning.",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "Optional location like city name or lat,lon pair.",
      },
    },
    additionalProperties: false,
  },
  async execute(args) {
    await assertIntegrationScope("weather", "read");
    const location = typeof args.location === "string" ? args.location : undefined;
    const context = await getWeatherContext({ location });
    return context;
  },
};
