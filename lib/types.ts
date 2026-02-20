export type ApprovalRule = "ask_first" | "auto_hold" | "auto_execute";
export type AutopilotStatus = "on" | "paused";
export type TriggerType = "time" | "context" | "event";

export type Autopilot = {
  id: string;
  name: string;
  goal: string;
  triggerType: TriggerType;
  trigger: string;
  action: string;
  approvalRule: ApprovalRule;
  status: AutopilotStatus;
  nextCheckIn: string;
  mode: string;
  budgetCap: number;
};

export type PackDataSource = {
  url: string;
  label: string;
  hint?: string;
};

export type Pack = {
  slug: string;
  name: string;
  city: string;
  modes: string[];
  style: string;
  budgetRange: string;
  needs: string[];
  description: string;
  instructions: string;
  tags: string[];
  dataSources: PackDataSource[];
};

export type SoftHold = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: "held" | "released";
};

export type Approval = {
  id: string;
  title: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  reason?: string;
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  details: string;
};

export type MemoryBucket =
  | "profile_memory"
  | "taste_memory"
  | "logistics_memory"
  | "history_memory";

export type MemoryEntry = {
  id: string;
  bucket: MemoryBucket;
  key: string;
  value: string;
  source: "user_input" | "inferred" | "imported" | "system";
  confidence: number;
  ttl?: string;
  pinned?: boolean;
  createdAt: string;
};

export type AutopilotRun = {
  id: string;
  autopilotId: string;
  scheduledAt: string;
  startedAt: string;
  status: "success" | "failed" | "pending";
  decisionTrace: string;
  actions: string[];
  approvalState: "none" | "pending" | "approved" | "rejected";
  idempotencyKey: string;
};

export type SafetySettings = {
  defaultApproval: ApprovalRule;
  spendCap: number;
  quietStart: string;
  quietEnd: string;
};

export type SchedulerJob = {
  id: string;
  autopilotId: string;
  triggerClass: string;
  status: string;
  cron?: string;
  watcher?: string;
};

