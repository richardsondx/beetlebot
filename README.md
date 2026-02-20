# beetlebot

beetlebot is an open-source, chat-first life operations agent that helps plan social time, free-time activities, and travel experiences with weather and calendar context.

## Core Concepts

- **Autopilots**: Goal + Trigger + Action + Approval.
- **Packs**: capability bundles for city/niche planning.
- **Soft-holds**: reserve time first, execute after approval.
- **Memory**: long-term local-first profile, taste, logistics, and history memory.

## Stack

- Next.js App Router + TypeScript + Tailwind
- API routes for planner runtime surfaces
- CLI package in `packages/cli`
- Runtime contracts in `docs/`

## Quickstart

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## CLI

Run:

```bash
npm run cli -- --help
```

## Key Docs

- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/PLAN_OBJECT_SCHEMA.md`
- `docs/PACK_SPEC.md`
- `docs/MEMORY_MODEL.md`
- `docs/AUTOPILOT_RUNTIME.md`
- `docs/API_ROUTES.md`
- `docs/CLI.md`

## Community Direction

The project is designed to support a builder tribe around the beetlebot mascot with practical, reusable Packs and transparent audit-first agent behavior.

