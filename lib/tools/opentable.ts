import { assertIntegrationScope } from "@/lib/integrations/scope-guard";
import {
  checkAvailability,
  generateBookingLink,
  searchRestaurants,
} from "@/lib/opentable/service";
import type { ChatToolDefinition } from "@/lib/tools/types";

const OPERATION_SCOPES: Record<string, "read" | "write"> = {
  search: "read",
  availability: "read",
  book: "write",
};

export const opentableTool: ChatToolDefinition = {
  name: "opentable_reservations",
  integration: "opentable",
  operationScopes: OPERATION_SCOPES,
  description:
    "Search restaurants, check availability, and generate booking links via OpenTable. " +
    "Use 'search' to find restaurants, 'availability' to check a specific restaurant, " +
    "and 'book' to generate a direct booking link.",
  parameters: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["search", "availability", "book"],
        description: "Operation to perform.",
      },
      query: {
        type: "string",
        description: "Search query (cuisine, restaurant name, etc.).",
      },
      restaurantName: {
        type: "string",
        description: "Restaurant name (required for availability and book).",
      },
      city: {
        type: "string",
        description: "City to search in (defaults to integration config).",
      },
      partySize: {
        type: "number",
        description: "Number of guests (defaults to integration config).",
      },
      date: {
        type: "string",
        description: "Date in YYYY-MM-DD format.",
      },
      time: {
        type: "string",
        description: "Time in HH:MM format (24h).",
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
        await assertIntegrationScope("opentable", requiredScope);
      }

      const common = {
        city: typeof args.city === "string" ? args.city : undefined,
        partySize: typeof args.partySize === "number" ? args.partySize : undefined,
        date: typeof args.date === "string" ? args.date : undefined,
        time: typeof args.time === "string" ? args.time : undefined,
      };

      switch (operation) {
        case "search":
          return await searchRestaurants({
            ...common,
            query: typeof args.query === "string" ? args.query : undefined,
          });

        case "availability": {
          if (typeof args.restaurantName !== "string") {
            return { error: "availability requires restaurantName" };
          }
          return await checkAvailability({
            ...common,
            restaurantName: args.restaurantName,
          });
        }

        case "book": {
          if (typeof args.restaurantName !== "string") {
            return { error: "book requires restaurantName" };
          }
          return await generateBookingLink({
            ...common,
            restaurantName: args.restaurantName,
          });
        }

        default:
          return {
            error: "Unknown operation. Use one of: search, availability, book.",
          };
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "OpenTable tool failed.",
      };
    }
  },
};
