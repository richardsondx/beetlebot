import { assertIntegrationScope } from "@/lib/integrations/scope-guard";
import type { ChatToolDefinition } from "@/lib/tools/types";
import { geocodeMapsLocation, getMapsRoute } from "@/lib/maps/service";

const OPERATION_SCOPES: Record<string, "read"> = {
  geocode: "read",
  route: "read",
};

export const mapsTool: ChatToolDefinition = {
  name: "maps",
  integration: "maps",
  operationScopes: OPERATION_SCOPES,
  description:
    "Geocode a place and estimate travel distance/time (with a directions link). Use this to add travel buffers between activities or to check if options are within the user's travel tolerance.",
  parameters: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["geocode", "route"],
        description: "Operation to perform.",
      },
      location: {
        type: "string",
        description: "For geocode: place name or 'lat,lon'.",
      },
      origin: {
        type: "string",
        description: "For route: origin place name or 'lat,lon'. Optional (defaults to Maps integration defaultLocation).",
      },
      destination: {
        type: "string",
        description: "For route: destination place name or 'lat,lon' (required).",
      },
      mode: {
        type: "string",
        enum: ["driving", "walking", "cycling", "transit"],
        description: "Travel mode for route.",
      },
    },
    required: ["operation"],
    additionalProperties: false,
  },
  async execute(args) {
    try {
      const operation = typeof args.operation === "string" ? args.operation : "";
      const requiredScope = OPERATION_SCOPES[operation];
      if (requiredScope) {
        await assertIntegrationScope("maps", requiredScope);
      }

      switch (operation) {
        case "geocode":
          return await geocodeMapsLocation({
            location: typeof args.location === "string" ? args.location : undefined,
          });
        case "route": {
          if (typeof args.destination !== "string" || !args.destination.trim()) {
            return { error: "route requires destination" };
          }
          return await getMapsRoute({
            origin: typeof args.origin === "string" ? args.origin : undefined,
            destination: args.destination,
            mode:
              typeof args.mode === "string" &&
              ["driving", "walking", "cycling", "transit"].includes(args.mode)
                ? (args.mode as "driving" | "walking" | "cycling" | "transit")
                : undefined,
          });
        }
        default:
          return { error: "Unknown operation. Use one of: geocode, route." };
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Maps tool failed.",
      };
    }
  },
};

