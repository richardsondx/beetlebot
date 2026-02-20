# 🪲 Beetlebot — Your Autonomous Life Agent

<p align="center">
  <br />
  <strong>IT DOESN'T SUGGEST PLANS. IT HANDLES THEM.</strong>
  <br />
  <br />
</p>

<p align="center">
  <a href="#quickstart"><img src="https://img.shields.io/badge/build-passing-brightgreen?style=flat-square" alt="Build" /></a>
  <a href="https://github.com/richardsondx/beetlebot/releases"><img src="https://img.shields.io/badge/release-v0.1.0-blue?style=flat-square" alt="Release" /></a>
  <a href="https://discord.gg/TWuKqaZxuc"><img src="https://img.shields.io/badge/Discord-The%20Colony-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-orange?style=flat-square" alt="License" /></a>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> · <a href="#how-it-works">How it works</a> · <a href="#cli">CLI</a> · <a href="docs/">Docs</a> · <a href="#the-colony">The Colony</a> · <a href="https://discord.gg/TWuKqaZxuc">Discord</a>
</p>

---

**Beetlebot** is an open-source AI agent that _autonomously_ plans your social life, weekend adventures, travel, and downtime. It reads your calendar, watches the weather, understands the season, knows your budget, learns your taste — and acts. Not a chatbot you talk _at_. A personal assistant that works _for_ you.

Other tools give you text. Beetlebot gives you your time back.

> The first time you wake up to a fully planned weekend you didn't have to think about — that's the moment. This is what AI was supposed to feel like.

## Highlights

- **Autonomous by default** — Beetlebot doesn't wait for you to ask. It monitors your calendar, checks the forecast, and acts when the moment is right. You set the goal once — it takes it from there.
- **Autopilots** — goal + trigger + action. "Empty Weekend + Rain" fires Friday at noon and books an indoor plan before you even open your phone.
- **Packs** — community-built planning skills for your city. Toronto Date Night. Rainy Day Rescue. Cottage Weekend. Install a pack or build your own.
- **Modes** — date night, family, social, travel, relax, focus. Switch modes and the entire agent adapts — different priorities, different actions, same intelligence.
- **Memory** — learns your preferences, remembers your history, and gets better over time. Local-first — your data never leaves your machine.
- **Multi-channel** — talks to you on web chat, Telegram, WhatsApp. Meets you where you already are.
- **Soft-holds** — proactively reserves time on your calendar, then follows through. No more "I should have booked that."
- **Smart guardrails** — you control what runs on autopilot and what needs a thumbs-up. Full audit trail on every action.

## How it works

```
   Telegram / WhatsApp / Web Chat
                │
                ▼
  ┌──────────────────────────────┐
  │       Beetlebot Runtime      │
  │     Next.js + TypeScript     │
  │    http://localhost:3000     │
  └──────────────┬───────────────┘
                 │
    ┌────────────┼────────────────┐
    │            │                │
    ▼            ▼                ▼
 Autopilot    Plan            Memory
  Engine     Compiler          Layer
    │            │                │
    ├── Triggers ├── Packs        ├── Profile
    ├── Scheduler├── Modes        ├── Taste
    └── Runs     └── Soft-holds   ├── Logistics
                                  └── History
                 │
    ┌────────────┼────────────────┐
    │            │                │
    ▼            ▼                ▼
 Calendar     Weather        Guardrails
 (Google)    (context)      (you control)
```

## Quickstart

Runtime: **Node >= 18**.

```bash
git clone https://github.com/richardsondx/beetlebot.git
cd beetlebot
npm install
cp .env.example .env   # then fill in your keys (see below)
npm run db:push         # push schema to local SQLite
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

That's it. The beetle is alive.

### Environment variables

Copy `.env.example` to `.env` and configure:

```bash
DATABASE_URL="file:./dev.db"
ENCRYPTION_KEY="<generate with: openssl rand -base64 32>"

# Public URL — needed for OAuth callbacks and channel webhooks (see ngrok section below)
NEXT_PUBLIC_APP_URL="https://xxxx.ngrok-free.app"
BEETLEBOT_BASE_URL="https://xxxx.ngrok-free.app"

# Required — at least one AI provider
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
```

### Running locally with ngrok

Channels like Telegram and WhatsApp need a public HTTPS URL to deliver webhooks. Google Calendar OAuth also needs a reachable callback URL. [ngrok](https://ngrok.com/) gives you one in seconds.

**1. Install ngrok** (one-time):

```bash
brew install ngrok    # macOS
# or download from https://ngrok.com/download
ngrok config add-authtoken <YOUR_NGROK_TOKEN>
```

**2. Start the tunnel** (run alongside `npm run dev`):

```bash
ngrok http 3000
```

ngrok prints a forwarding URL like `https://a1b2-50-101-16-68.ngrok-free.app`.

**3. Update `.env`** with that URL:

```bash
NEXT_PUBLIC_APP_URL="https://a1b2-50-101-16-68.ngrok-free.app"
BEETLEBOT_BASE_URL="https://a1b2-50-101-16-68.ngrok-free.app"
```

Then restart the dev server so Next.js picks up the new values.

> **Tip:** Free ngrok URLs change every time you restart the tunnel. If you have a paid plan, use a stable subdomain: `ngrok http --domain=beetlebot.ngrok.dev 3000`.

### Database

Beetlebot uses SQLite (via Prisma) — zero config, local-first.

```bash
npm run db:push        # Push schema to local SQLite
npm run prisma:generate # Generate Prisma client
```

### Encryption

Sensitive integration credentials (OAuth tokens, API keys) are encrypted at rest in the database using AES-256-GCM. Generate your key once and keep it in `.env`:

```bash
openssl rand -base64 32
# paste the output as ENCRYPTION_KEY in .env
```

## CLI

Beetlebot ships with a full CLI and interactive TUI.

```bash
npm run cli -- --help
```

### Key commands

```bash
beetlebot tui                              # Interactive terminal UI
beetlebot dev                              # Dev mode
beetlebot autopilot list                   # List autopilots
beetlebot autopilot run <id>               # Run an autopilot
beetlebot pack list                        # List installed packs
beetlebot pack install <slug>              # Install a community pack
beetlebot approvals list                   # Pending approvals
beetlebot memory list --bucket taste       # Inspect memory
beetlebot integrations list                # Integration status
beetlebot integrations connect telegram    # Connect Telegram
```

### TUI commands

Launch with `beetlebot tui`, then use:

| Command | Description |
|---|---|
| `/help` | Show all commands |
| `/status` | Session status |
| `/model set <provider/model>` | Switch AI model |
| `/autopilots` | List autopilots |
| `/packs` | Browse packs |
| `/runs` | Recent autopilot runs |
| `/approvals` | Pending approvals |
| `/memory [bucket]` | Inspect memory |
| `/connect <provider>` | Connect integration |
| `/new` | New conversation |
| `/context show` | Toggle context overlay |

**TUI keys:** `Enter` submit, `Ctrl+K` toggle context, `Ctrl+L` clear, `Ctrl+C` quit.

## Core concepts

### Autopilots

Tell the beetle what you care about. It figures out the when, the how, and the follow-through.

```
"Plan a date night when Saturday is open and weather is good"
  → Goal:    Date night
  → Trigger: Saturday free + clear forecast
  → Action:  Generate plan, hold calendar, book restaurant
  → Result:  You wake up Saturday with a plan ready to go
```

**Trigger classes:**
- **Time triggers** — cron-backed schedules (e.g., every Friday at noon).
- **Context triggers** — reacts to real-world changes (calendar opens up, weather shifts, budget resets).
- **Event triggers** — lifecycle events (booking fail, RSVP, birthday windows).

### Packs

Community-curated capability bundles for life planning.

```json
{
  "slug": "cottage-weekend-pack",
  "name": "Cottage Weekend Pack",
  "city": "Muskoka",
  "modes": ["family", "relax"],
  "budgetRange": "$120-$380",
  "description": "Plans cottage weekends with weather fallback, drive buffers, and grocery stop reminders."
}
```

Every city deserves a local expert. Build a pack, share it with the Colony.

### Memory

Beetlebot remembers everything — your preferences, your history, what worked and what didn't. The more you use it, the better it gets. All stored locally on your machine.

| Bucket | What the beetle learns |
|---|---|
| `profile_memory` | Who you are, your relationships, hard constraints |
| `taste_memory` | What you love, what you hate, your vibe |
| `logistics_memory` | How far you'll drive, your timing, budget defaults |
| `history_memory` | Past plans, outcomes, what landed and what flopped |

You can inspect, correct, or wipe any memory at any time. Your data, your machine, your rules.

### Soft-holds

The beetle proactively blocks time on your calendar when it spots an opportunity — then follows through with the full plan. No more "I should've booked that" moments.

## Integrations

### Google Calendar

Fully managed through the web UI — no env vars needed. Go to **Settings**, click **Connect** for Google Calendar, enter your OAuth client ID and secret, then sign in with Google. Beetlebot stores the credentials encrypted in the local database and handles token refresh automatically.

The OAuth callback URL is `<your-base-url>/api/integrations/google-calendar/callback` — register this in your Google Cloud Console.

```bash
# Or via CLI
beetlebot integrations connect google_calendar
```

### Telegram

```bash
beetlebot integrations connect telegram --bot-token <TOKEN>
# Or in TUI: /connect telegram botToken=<TOKEN>
```

### WhatsApp (Meta Cloud API)

```bash
beetlebot integrations connect whatsapp --access-token <TOKEN> --phone-number-id <ID>
```

## API routes

Full REST API for building on top of Beetlebot.

| Area | Endpoints |
|---|---|
| **Chat** | `POST /api/chat` |
| **Autopilots** | `GET/POST /api/autopilots`, `PATCH/DELETE /api/autopilots/:id`, `POST .../preview`, `POST .../run` |
| **Packs** | `GET/POST /api/packs`, `POST /api/packs/install` |
| **Calendar** | `GET /api/calendar/availability`, `POST/PATCH/DELETE /api/calendar/soft-holds` |
| **Memory** | `GET /api/memory`, `POST /api/memory/upsert`, `POST /api/memory/forget` |
| **Approvals** | `GET /api/approvals`, `POST /api/approvals/:id/approve\|reject` |
| **Weather** | `GET /api/weather/context` |
| **Integrations** | `GET/POST /api/integrations/:provider/connect\|disconnect\|test` |
| **Scheduler** | `GET /api/scheduler/jobs`, `POST /api/scheduler/reconcile` |
| **Audit** | `GET /api/audit`, `GET /api/debug/traces` |

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | SQLite via Prisma |
| AI | OpenAI / Anthropic (configurable) |
| Tests | Vitest |
| CLI | Commander + tsx |
| Validation | Zod |

## Project structure

```
beetlebot/
├── app/                    # Next.js app (pages + API routes)
│   ├── (app)/              # App pages (chat, autopilots, calendar, packs, settings)
│   └── api/                # REST API routes
├── components/             # React components
├── lib/                    # Core runtime modules
│   ├── chat/               # Chat engine, safety, research loop
│   ├── runtime/            # Autopilot runner + scheduler
│   ├── repositories/       # Data access layer
│   ├── tools/              # Tool registry (weather, calendar, OpenTable)
│   ├── integrations/       # Channel adapters (Telegram, WhatsApp, Google)
│   └── weather/            # Weather service
├── packages/
│   ├── cli/                # CLI + TUI package
│   └── travel-cli/         # Travel planning CLI (Go)
├── prisma/                 # Database schema
├── docs/                   # Architecture + spec docs
└── tests/                  # Test suites
```

## Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run test         # Run tests
npm run lint         # Lint
npm run typecheck    # Type-check
npm run db:push      # Push Prisma schema
```

## Docs

Deep reference docs live in `docs/`:

- **[PRD](docs/PRD.md)** — product requirements
- **[Architecture](docs/ARCHITECTURE.md)** — system design and phases
- **[Autopilot Runtime](docs/AUTOPILOT_RUNTIME.md)** — trigger classes, execution guarantees
- **[Pack Spec](docs/PACK_SPEC.md)** — how to build a pack
- **[Memory Model](docs/MEMORY_MODEL.md)** — buckets, governance, user controls
- **[Plan Object Schema](docs/PLAN_OBJECT_SCHEMA.md)** — the plan contract
- **[API Routes](docs/API_ROUTES.md)** — full endpoint reference
- **[CLI](docs/CLI.md)** — commands, TUI, integration setup

## The Colony

Beetlebot isn't a product with a waitlist. It's a movement with a repo.

**The Colony** is the community building the autonomous life agent they actually want to use. No corporate roadmap. No feature gates. Just people who believe AI should handle the boring parts of life so you can live the interesting parts.

### How to contribute

- **Build Packs** — create planning skills for your city. Share local knowledge globally. Every city deserves a local expert.
- **Shape the roadmap** — the best features come from real people with real weekends. Open issues, open PRs, open conversations.
- **Fork it. Own it.** — open source means your agent, your rules. Self-host it, extend it, make it yours. No vendor lock-in. Ever.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Community channels

- **[Discord](https://discord.gg/TWuKqaZxuc)** — join The Colony
- **[GitHub Issues](https://github.com/richardsondx/beetlebot/issues)** — bugs, features, ideas
- **[GitHub Discussions](https://github.com/richardsondx/beetlebot/discussions)** — questions, show & tell

AI/vibe-coded PRs welcome.

## Author

Built by **[Richardson Dackam](https://x.com/richardsondx)** ([@richardsondx](https://x.com/richardsondx)) while Beetlebot handled his weekends.

## License

[MIT](LICENSE) — the beetle is free. Always.
