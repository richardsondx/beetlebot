import { z } from "zod";

export const createAutopilotSchema = z.object({
  name: z.string().min(2),
  goal: z.string().min(5),
  triggerType: z.enum(["time", "context", "event"]),
  trigger: z.string().min(2),
  action: z.string().min(3),
  approvalRule: z.enum(["ask_first", "auto_hold", "auto_execute"]),
  mode: z.string().min(2),
  budgetCap: z.number().int().positive().max(10000),
  nextCheckIn: z.string().datetime().optional(),
  status: z.enum(["on", "paused"]).optional(),
});

export const updateAutopilotSchema = createAutopilotSchema.partial();

export const chatSchema = z.object({
  message: z.string().min(1),
  threadId: z.string().min(8).optional(),
  mode: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
});

export const installPackSchema = z.object({
  slug: z.string().min(2),
});

export const createPackSchema = z.object({
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug must use lowercase letters, numbers, and hyphens."),
  name: z.string().min(2),
  city: z.string().min(1),
  modes: z.array(z.string().min(1)).min(1),
  style: z.string().min(2),
  budgetRange: z.string().min(2),
  needs: z.array(z.string().min(1)).default([]),
  description: z.string().min(8),
  instructions: z.string().default(""),
  tags: z.array(z.string().min(1)).default([]),
  dataSources: z
    .array(
      z.object({
        url: z.string().url(),
        label: z.string().min(1),
        hint: z.string().optional(),
      }),
    )
    .default([]),
});

export const updatePackSchema = z.object({
  slug: z.string().min(2),
  name: z.string().min(2).optional(),
  city: z.string().min(1).optional(),
  modes: z.array(z.string().min(1)).min(1).optional(),
  style: z.string().min(2).optional(),
  budgetRange: z.string().min(2).optional(),
  needs: z.array(z.string().min(1)).optional(),
  description: z.string().min(8).optional(),
  instructions: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  dataSources: z
    .array(
      z.object({
        url: z.string().url(),
        label: z.string().min(1),
        hint: z.string().optional(),
      }),
    )
    .optional(),
});

export const createSoftHoldSchema = z.object({
  title: z.string().min(2),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

export const updateSoftHoldSchema = z
  .object({
    title: z.string().min(2).optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    status: z.enum(["held", "released"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update a soft hold.",
  });

export const rejectApprovalSchema = z.object({
  reason: z.string().min(2).optional(),
});

export const memoryUpsertSchema = z.object({
  id: z.string().optional(),
  bucket: z.enum(["profile_memory", "taste_memory", "logistics_memory", "history_memory"]),
  key: z.string().min(1),
  value: z.string().min(1),
  source: z.enum(["user_input", "inferred", "imported", "system"]).default("system"),
  confidence: z.number().min(0).max(1).default(0.5),
  ttl: z.string().datetime().optional(),
  pinned: z.boolean().optional(),
});

export const memoryForgetSchema = z.object({
  id: z.string().optional(),
  key: z.string().optional(),
});

export const updateSafetySettingsSchema = z
  .object({
    defaultApproval: z.enum(["ask_first", "auto_hold", "auto_execute"]).optional(),
    spendCap: z.number().int().positive().max(10000).optional(),
    quietStart: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Must be HH:MM format")
      .optional(),
    quietEnd: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Must be HH:MM format")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required.",
  });

export const integrationProviderSchema = z.enum([
  "telegram",
  "whatsapp",
  "google_calendar",
  "weather",
  "opentable",
  "maps",
]);

export const telegramConnectSchema = z.object({
  botToken: z.string().min(10),
  webhookUrl: z.string().url().optional(),
});

export const whatsappConnectSchema = z.object({
  accessToken: z.string().min(10),
  phoneNumberId: z.string().min(5),
  businessAccountId: z.string().min(3).optional(),
});

export const googleCalendarConnectSchema = z.object({
  code: z.string().min(4).optional(),
  redirectUri: z.string().url().optional(),
  state: z.string().min(1).optional(),
  calendarId: z.string().min(1).optional(),
  clientId: z.string().min(10).optional(),
  clientSecret: z.string().min(10).optional(),
});

export const weatherConnectSchema = z.object({
  weatherProvider: z.enum(["open_meteo"]).default("open_meteo"),
  apiKey: z.string().min(10).optional(),
  defaultLocation: z.string().min(2).optional(),
  units: z.enum(["metric", "imperial"]).default("metric"),
});

export const opentableConnectSchema = z.object({
  defaultCity: z.string().min(2).optional(),
  defaultPartySize: z.coerce.number().int().min(1).max(20).default(2),
});

export const mapsConnectSchema = z.object({
  mapsProvider: z.enum(["approx", "openrouteservice"]).default("approx"),
  apiKey: z.string().min(10).optional(),
  defaultLocation: z.string().min(2).optional(),
  units: z.enum(["metric", "imperial"]).default("metric"),
});
