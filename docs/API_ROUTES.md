# API Routes

## Chat
- `POST /api/chat`

## Autopilots
- `GET /api/autopilots`
- `POST /api/autopilots`
- `GET /api/autopilots/:id`
- `PATCH /api/autopilots/:id`
- `DELETE /api/autopilots/:id`
- `POST /api/autopilots/:id/preview`
- `POST /api/autopilots/:id/run`

## Packs
- `GET /api/packs`
- `POST /api/packs`
- `POST /api/packs/install`

## Calendar
- `GET /api/calendar/availability`
- `POST /api/calendar/soft-holds`
- `PATCH /api/calendar/soft-holds/:id`
- `DELETE /api/calendar/soft-holds/:id`

## Integrations
- `GET /api/integrations`
- `GET /api/integrations/:provider` (`telegram` | `whatsapp` | `google_calendar`)
- `POST /api/integrations/:provider/connect`
- `POST /api/integrations/:provider/disconnect`
- `POST /api/integrations/:provider/test`
- `GET /api/integrations/google-calendar/callback` (OAuth redirect target)
- `POST /api/webhooks/telegram` (Telegram incoming updates)

## Weather
- `GET /api/weather/context`

## Approvals
- `GET /api/approvals`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`

## Audit + Debug
- `GET /api/audit`
- `GET /api/debug/traces`

## CLI Session
- `POST /api/cli/session`

## Memory
- `GET /api/memory`
- `POST /api/memory/upsert`
- `POST /api/memory/forget`
- `GET /api/memory/taste-profile`

## Runtime + Scheduler
- `GET /api/autopilot-runs`
- `GET /api/autopilot-runs/:id`
- `POST /api/autopilot-runs/:id/retry`
- `GET /api/scheduler/jobs`
- `POST /api/scheduler/reconcile`

