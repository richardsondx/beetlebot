import {
  Approval,
  Autopilot,
  AutopilotRun,
  AuditEvent,
  MemoryEntry,
  Pack,
  SchedulerJob,
  SoftHold,
} from "@/lib/types";

const now = () => new Date().toISOString();

export const autopilots: Autopilot[] = [
  {
    id: "ap-weekend",
    name: "Empty Weekend + Weather",
    goal: "Fill a free Saturday with a weather-aware plan",
    triggerType: "time",
    trigger: "Friday 12:00",
    action: "Propose full Saturday plan and create soft hold",
    approvalRule: "ask_first",
    status: "on",
    nextCheckIn: "2026-02-20T12:00:00.000Z",
    mode: "explore",
    budgetCap: 180,
  },
  {
    id: "ap-date-night",
    name: "Date Night Operator",
    goal: "Create weekly date-night options under budget",
    triggerType: "time",
    trigger: "Tuesday 15:00",
    action: "Hold 18:00-21:00 and suggest 2 plans",
    approvalRule: "ask_first",
    status: "on",
    nextCheckIn: "2026-02-24T15:00:00.000Z",
    mode: "dating",
    budgetCap: 150,
  },
];

export const packs: Pack[] = [
  {
    slug: "toronto-date-night-pack",
    name: "Toronto Date Night Pack",
    city: "Toronto",
    modes: ["dating", "social"],
    style: "chill",
    budgetRange: "$80-$160",
    needs: ["calendar:read", "weather:read", "maps:read"],
    description: "Curated date-night ideas with weather fallback and travel buffers.",
    instructions: "Favor cozy spots with backup indoor options and easy transit access.",
    tags: ["dating", "toronto", "curated"],
    dataSources: [],
  },
  {
    slug: "rainy-day-rescue",
    name: "Rainy Day Rescue",
    city: "Any",
    modes: ["family", "relax", "social"],
    style: "predictable",
    budgetRange: "$20-$120",
    needs: ["weather:read", "calendar:read"],
    description: "Automatically swaps outdoor plans with strong indoor alternatives.",
    instructions: "Prioritize low-friction indoor plans when rain risk is elevated.",
    tags: ["family", "rainy-day", "backup-plans"],
    dataSources: [],
  },
];

export const softHolds: SoftHold[] = [
  {
    id: "hold-1",
    title: "Soft hold: Saturday adventure",
    startAt: "2026-02-21T10:00:00.000Z",
    endAt: "2026-02-21T15:00:00.000Z",
    status: "held",
  },
];

export const approvals: Approval[] = [
  { id: "apr-1", title: "Reserve 2 tickets", amount: 64, status: "pending" },
];

export const auditEvents: AuditEvent[] = [
  {
    id: "audit-1",
    at: now(),
    actor: "autopilot:ap-weekend",
    action: "drafted_plan",
    details: "Generated 3 weather-aware options for Saturday.",
  },
];

export const memoryEntries: MemoryEntry[] = [
  {
    id: "mem-1",
    bucket: "taste_memory",
    key: "favorite_activity",
    value: "local events",
    source: "system",
    confidence: 0.4,
    createdAt: now(),
    pinned: false,
  },
  {
    id: "mem-2",
    bucket: "logistics_memory",
    key: "max_travel_minutes",
    value: "20",
    source: "user_input",
    confidence: 1,
    createdAt: now(),
  },
];

export const autopilotRuns: AutopilotRun[] = [
  {
    id: "run-1",
    autopilotId: "ap-weekend",
    scheduledAt: "2026-02-20T12:00:00.000Z",
    startedAt: "2026-02-20T12:00:10.000Z",
    status: "success",
    decisionTrace: "Weekend free slot found; rain probability 72%; switched to indoor plan.",
    actions: ["generated_suggestions", "created_soft_hold"],
    approvalState: "pending",
    idempotencyKey: "ap-weekend-2026-02-20T12:00",
  },
];

export const schedulerJobs: SchedulerJob[] = [
  {
    id: "job-1",
    autopilotId: "ap-weekend",
    triggerClass: "time",
    cron: "0 12 * * FRI",
    status: "queued",
  },
  {
    id: "job-2",
    autopilotId: "ap-date-night",
    triggerClass: "context",
    watcher: "calendar_gap_detector",
    status: "active",
  },
];

export const debugTraces = [
  {
    id: "trace-1",
    at: now(),
    scope: "autopilot_run",
    message: "Compiled plan object with indoor fallback.",
  },
];

export function addAudit(action: string, details: string, actor = "system") {
  auditEvents.unshift({
    id: `audit-${Date.now()}`,
    at: now(),
    actor,
    action,
    details,
  });
}

