# Architecture

## Phase 1

- Next.js App Router + TypeScript + Tailwind for product and API routes.
- In-process runtime modules in `lib/`.
- Adapter-style boundary for external providers (calendar, weather, maps, chat).
- Approval gates and audit log are first-class.

## Phase 2+

- Extract runtime logic into `packages/core`.
- Keep `packages/shared` as single source for contracts.
- Add worker/scheduler process if needed for long-running trigger evaluation.

## Core Modules

- `AutopilotEngine`: trigger evaluation and run orchestration.
- `PlanCompiler`: converts intent and context into plan objects.
- `PermissionGates`: ask-first / auto-hold / auto-execute policy.
- `MemoryLayer`: persistent profile, taste, logistics, and history memory.
- `AuditStream`: traceable records for all decisions and actions.

