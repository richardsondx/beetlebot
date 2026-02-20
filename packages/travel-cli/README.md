# Beetlebot Travel CLI

A local-first travel search broker that aggregates flights, hotels, and alternative stays into compact JSON output for AI consumption.

## Quick Start (No Keys Required)

```bash
# Build
cd packages/travel-cli
go build -o travel ./cmd/travel/

# Search flights (mock mode — default, no API keys needed)
./travel flights search --from YUL --to CDG --depart 2026-06-12 --return 2026-06-20

# Search stays
./travel stays search --city Paris --checkin 2026-06-12 --checkout 2026-06-20

# Check system health
./travel doctor
```

Mock mode is the default. It returns deterministic, realistic sample data so you can develop and test without any provider accounts.

## Mode Toggle

Switch between `mock`, `live`, and `hybrid` modes:

```bash
# Per-command flag
./travel flights search --from JFK --to LAX --depart 2026-07-01 --mode live

# Or set globally via environment
export TRAVEL_MODE=hybrid
./travel flights search --from JFK --to LAX --depart 2026-07-01
```

| Mode     | Behavior |
|----------|----------|
| `mock`   | Uses built-in fixture data. No credentials needed. |
| `live`   | Uses only real provider APIs. Requires credentials. |
| `hybrid` | Uses live providers where credentials exist, falls back to mock for the rest. |

## CLI Commands

| Command | Description |
|---------|-------------|
| `travel flights search` | Search for flights |
| `travel stays search` | Search for hotels, Airbnb, camping, etc. |
| `travel offers combine` | Combine a flight + stay into a trip package |
| `travel offers reprice` | Reprice a cached offer with fresh data |
| `travel providers list` | List all providers and their status |
| `travel doctor` | Validate config, credentials, and provider health |
| `travel version` | Print CLI version |

## Provider Tiers

Not all providers require enterprise contracts. Here's the accessibility matrix:

| Provider | Type | Tier | How to Get Access |
|----------|------|------|-------------------|
| **Duffel** | Flights | `easySignup` | Free account at [duffel.com](https://duffel.com). Set `DUFFEL_API_TOKEN`. |
| **Expedia Rapid** | Hotels | `partnerRequired` | Partner signup at [developers.expediagroup.com](https://developers.expediagroup.com). Set `EXPEDIA_API_KEY` + `EXPEDIA_API_SECRET`. |
| **Airbnb** | Alt-stays | `partnerRequired` | Affiliate/partner program. Set `AIRBNB_AFFILIATE_ID`. |
| **Amadeus** | Flights | `easySignup` | Free tier at [developers.amadeus.com](https://developers.amadeus.com). *(Coming soon)* |
| **Hipcamp** | Camping | `partnerRequired` | Partner API when available. *(Coming soon)* |
| **Booking.com** | Hotels | `partnerRequired` | Affiliate program. *(Coming soon)* |

### Tier Definitions

- **easySignup**: Self-serve registration, free tier or trial available. Any user can sign up.
- **partnerRequired**: Requires partner/affiliate application. Approval may take time.
- **enterpriseOnly**: Requires business contract. Not practical for individual users.

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `TRAVEL_MODE` | Default mode: `mock`, `live`, `hybrid` |
| `TRAVEL_PROVIDERS` | Comma-separated list of additional providers to enable |
| `TRAVEL_CONFIG` | Path to custom config YAML |
| `DUFFEL_API_TOKEN` | Duffel API token |
| `EXPEDIA_API_KEY` | Expedia Rapid API key |
| `EXPEDIA_API_SECRET` | Expedia Rapid API secret |
| `AIRBNB_AFFILIATE_ID` | Airbnb affiliate ID |

### Config File

Place a YAML config at `~/.config/beetlebot/travel.yaml` or point to one with `TRAVEL_CONFIG`:

```yaml
mode: hybrid

providers:
  duffel:
    enabled: true
    priority: 80
    envKeys:
      apiToken: DUFFEL_API_TOKEN
  expedia:
    enabled: true
    priority: 70
    envKeys:
      apiKey: EXPEDIA_API_KEY
      apiSecret: EXPEDIA_API_SECRET
```

See `configs/providers.example.yaml` for the full template.

## Architecture

```
AI Agent
  └── travel CLI (one tool call)
        └── Provider Router (mode gate)
              ├── Mock Adapters (always available)
              └── Live Adapters (credential-gated)
                    ├── Official APIs (Duffel, Amadeus, Expedia…)
                    └── Deep-link / Affiliate (Airbnb, Hipcamp…)
        └── Normalizer → Ranker → Cache → JSON Output
```

### Design Principles

1. **Local-first**: Each Beetlebot instance runs its own CLI. No central proxy.
2. **No vendor lock-in**: Every provider is optional and independently toggleable.
3. **Graceful degradation**: Missing credentials = fallback to mock, not an error.
4. **AI-optimized output**: Compact JSON with `source`, `confidence`, `isBookable`, and `repriceRequired` fields.
5. **Community extensible**: The adapter interface is stable — anyone can add a regional provider.

## Adding a New Provider

1. Create a new file in `internal/adapters/live/`.
2. Implement the `FlightAdapter` or `StayAdapter` interface.
3. Register it in `cmd/travel/commands/wire.go`.
4. Add credential env vars and document in this README.

## Sustainability & Partnership Strategy

### The Problem
Centralized API keys don't scale when thousands of local Beetlebot instances each need provider access.

### The Approach
- **Distributed execution**: Each user's machine makes its own provider calls. No central bottleneck.
- **Hybrid inventory**: Official APIs where accessible, deep-links/affiliates where not, mocks as fallback.
- **Volume as leverage**: As Beetlebot adoption grows, travel providers will see organic traffic from many independent users — a natural signal for official integration partnerships.
- **Opt-in demand metrics**: Anonymized, aggregate route/city demand data (opt-in only) can support partnership conversations with providers.
- **Community adapters**: Stable interface encourages community-contributed adapters for region-specific providers.

### Outcome
Beetlebot sends real customers to travel providers. The more users adopt it, the stronger the case for providers to offer first-class API access — turning distributed usage into partnership leverage.

## Testing

```bash
go test ./... -v
```

## License

Internal — Beetlebot project.
