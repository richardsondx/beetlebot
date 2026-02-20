# Pack Spec

Packs are user-facing capability bundles for life planning.

## Required Metadata

- Name and slug
- Supported modes
- Coverage area (city or global)
- Required permissions
- Typical budget range
- Approval behavior defaults

### Example Config

```json
{
  "slug": "cottage-weekend-pack",
  "name": "Cottage Weekend Pack",
  "city": "Muskoka",
  "modes": ["family", "relax"],
  "style": "predictable",
  "budgetRange": "$120-$380",
  "needs": ["calendar:read", "weather:read", "maps:read"],
  "description": "Plans cottage weekends with weather fallback, drive buffers, and grocery stop reminders."
}
```

## Required Runtime Output

- Must emit a valid Plan Object.
- Must declare weather assumptions and fallback strategy.
- Must not bypass approval gates.

## Quality Signals

- plan acceptance rate
- plan completion rate
- low cancellation rate
- low over-budget rate
- positive user feedback

