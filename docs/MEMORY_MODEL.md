# Memory Model

beetlebot uses local-first persistent memory with governance.

## Buckets

- `profile_memory`: identity, relationships, hard constraints.
- `taste_memory`: likes, dislikes, vibe preferences.
- `logistics_memory`: travel radius, timing, budget defaults.
- `history_memory`: executed plans and outcomes.

## Governance Fields

- `source`: user_input, inferred, imported, system.
- `confidence`: confidence for inferred values.
- `ttl`: optional expiry for temporary context.
- `pinned`: user-protected memory entry.

## User Controls

- Forget memory (`POST /api/memory/forget`)
- Correct memory (`POST /api/memory/upsert`)
- Inspect memory (`GET /api/memory`)

