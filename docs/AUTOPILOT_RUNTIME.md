# Autopilot Runtime

Autopilots use a human model:

- Goal
- Trigger
- Action
- Approval rule

Internally this compiles to durable scheduler jobs and watchers.

## Trigger Classes

- Time triggers: cron-backed schedules.
- Context triggers: state transitions (calendar/weather/budget).
- Event triggers: lifecycle events (booking fail, RSVP, birthday windows).

## Execution Guarantees

- idempotency key for every run
- retry with backoff
- dead-letter handling for persistent failures
- run records with trace, actions, and approval state

## Core Endpoints

- `GET /api/autopilot-runs`
- `GET /api/autopilot-runs/:id`
- `POST /api/autopilot-runs/:id/retry`
- `GET /api/scheduler/jobs`
- `POST /api/scheduler/reconcile`

