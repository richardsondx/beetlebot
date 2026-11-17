import Link from "next/link";

const QUICKSTART_STEPS = [
  {
    title: "Install and run",
    command: "git clone https://github.com/richardsondx/beetlebot.git\ncd beetlebot\nnpm install\nnpm run dev",
    note: "Start the app at http://localhost:3000.",
  },
  {
    title: "Set environment variables",
    command:
      'cp .env.example .env\n# add provider keys and encryption key\nopenssl rand -base64 32  # set as ENCRYPTION_KEY',
    note: "At least one model provider key is required.",
  },
  {
    title: "Initialize database",
    command: "npm run db:push\nnpm run prisma:generate",
    note: "SQLite is local-first and zero-config.",
  },
];

const CORE_CONCEPTS = [
  {
    title: "Autopilots",
    description:
      "Set a goal once. Beetlebot watches triggers like time, weather, and free calendar windows, then executes the plan flow.",
  },
  {
    title: "Modes",
    description:
      "Use Auto, Explore, Date Night, Family, Social, Relax, Travel, or Focus to shape planning behavior and output style.",
  },
  {
    title: "Packs",
    description:
      "Install community-created planning capabilities for cities, vibes, or recurring scenarios with reusable rules.",
  },
  {
    title: "Approvals",
    description:
      "Control autonomy boundaries. Decide what can run automatically versus actions that require your confirmation.",
  },
];

const API_GROUPS = [
  { area: "Chat", endpoints: ["POST /api/chat"] },
  {
    area: "Autopilots",
    endpoints: [
      "GET, POST /api/autopilots",
      "PATCH, DELETE /api/autopilots/:id",
      "POST /api/autopilots/:id/preview",
      "POST /api/autopilots/:id/run",
    ],
  },
  {
    area: "Calendar",
    endpoints: [
      "GET /api/calendar/availability",
      "POST, PATCH, DELETE /api/calendar/soft-holds",
    ],
  },
  {
    area: "Memory",
    endpoints: ["GET /api/memory", "POST /api/memory/upsert", "POST /api/memory/forget"],
  },
  {
    area: "Integrations",
    endpoints: ["GET, POST /api/integrations/:provider/connect", "POST /api/integrations/:provider/test"],
  },
];

const CLI_COMMANDS = [
  "beetlebot tui",
  "beetlebot dev",
  "beetlebot autopilot list",
  "beetlebot autopilot run <id>",
  "beetlebot pack list",
  "beetlebot integrations connect telegram",
];

const NAV_ITEMS = [
  { id: "quickstart", label: "Quickstart" },
  { id: "concepts", label: "Core concepts" },
  { id: "integrations", label: "Integrations" },
  { id: "api", label: "API reference" },
  { id: "cli", label: "CLI" },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-white text-[#1C1B19]">
      <header className="sticky top-0 z-40 border-b border-[#E7E5E0] bg-[#F2F1EE] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 text-[#8A5710]">
            <span className="text-lg">🪲</span>
            <span className="text-base font-semibold tracking-tight">beetlebot docs</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <a
              href="https://github.com/richardsondx/beetlebot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6B6862] transition-colors hover:text-[#1C1B19]"
            >
              GitHub
            </a>
            <a
              href="https://discord.gg/TWuKqaZxuc"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-[#E7E5E0] bg-[#FBF1E1] px-3 py-1.5 text-[#8A5710] transition-colors hover:bg-[#A96B12]/20"
            >
              Join Discord
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-xl border border-[#E7E5E0] bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6B6862]">On this page</p>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block rounded-md px-3 py-2 text-sm text-[#6B6862] transition-colors hover:bg-[#F2F1EE] hover:text-[#1C1B19]"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <div className="space-y-12">
          <section className="rounded-2xl border border-[#E7E5E0] bg-white p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#8A5710]">Documentation</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1C1B19] sm:text-5xl">
              Build with Beetlebot fast
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#6B6862] sm:text-lg">
              This guide is designed for speed: get running, understand the core primitives, connect integrations, and
              ship confidently with clear API and CLI references.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <a
                href="#quickstart"
                className="rounded-md border border-[#E7E5E0] bg-[#F2F1EE] px-3 py-1.5 text-[#1C1B19] transition-colors hover:bg-[#F2F1EE]"
              >
                Start in 3 steps
              </a>
              <a
                href="#api"
                className="rounded-md border border-[#E7E5E0] bg-[#F2F1EE] px-3 py-1.5 text-[#1C1B19] transition-colors hover:bg-[#F2F1EE]"
              >
                API reference
              </a>
              <a
                href="#cli"
                className="rounded-md border border-[#E7E5E0] bg-[#F2F1EE] px-3 py-1.5 text-[#1C1B19] transition-colors hover:bg-[#F2F1EE]"
              >
                CLI commands
              </a>
            </div>
          </section>

          <section id="quickstart" className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-[#1C1B19] sm:text-3xl">Quickstart</h2>
            <p className="text-[#6B6862]">
              If you only do one thing, do this section. It gets your local setup working with minimal friction.
            </p>
            <div className="space-y-4">
              {QUICKSTART_STEPS.map((step, idx) => (
                <article key={step.title} className="rounded-xl border border-[#E7E5E0] bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#6B6862]">Step {idx + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold text-[#1C1B19]">{step.title}</h3>
                  <pre className="mt-3 overflow-x-auto rounded-lg border border-[#E7E5E0] bg-white p-4 text-sm text-[#1C1B19]">
                    <code>{step.command}</code>
                  </pre>
                  <p className="mt-3 text-sm text-[#6B6862]">{step.note}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="concepts" className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-[#1C1B19] sm:text-3xl">Core concepts</h2>
            <p className="text-[#6B6862]">
              These building blocks explain how Beetlebot behaves and where to customize your workflow.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {CORE_CONCEPTS.map((concept) => (
                <article key={concept.title} className="rounded-xl border border-[#E7E5E0] bg-white p-5">
                  <h3 className="text-lg font-semibold text-[#1C1B19]">{concept.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6B6862]">{concept.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="integrations" className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-[#1C1B19] sm:text-3xl">Integrations</h2>
            <div className="rounded-xl border border-[#E7E5E0] bg-white p-6">
              <p className="text-sm leading-relaxed text-[#6B6862]">
                Connect Google Calendar, Telegram, or WhatsApp from <strong className="text-[#1C1B19]">Settings</strong>{" "}
                in the app, or use CLI commands for scripted setup. Credentials are encrypted at rest in your local
                database.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-lg border border-[#E7E5E0] bg-white p-4 text-sm text-[#1C1B19]">
                <code>
                  {"beetlebot integrations list\nbeetlebot integrations connect google_calendar\nbeetlebot integrations connect telegram"}
                </code>
              </pre>
            </div>
          </section>

          <section id="api" className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-[#1C1B19] sm:text-3xl">API reference</h2>
            <p className="text-[#6B6862]">Most teams begin with chat and autopilot endpoints, then layer calendar and memory flows.</p>
            <div className="space-y-4">
              {API_GROUPS.map((group) => (
                <article key={group.area} className="rounded-xl border border-[#E7E5E0] bg-white p-5">
                  <h3 className="text-lg font-semibold text-[#1C1B19]">{group.area}</h3>
                  <ul className="mt-3 space-y-2">
                    {group.endpoints.map((endpoint) => (
                      <li key={endpoint} className="rounded-md border border-[#E7E5E0] bg-white px-3 py-2 font-mono text-xs text-[#1C1B19] sm:text-sm">
                        {endpoint}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section id="cli" className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-[#1C1B19] sm:text-3xl">CLI</h2>
            <p className="text-[#6B6862]">Use the CLI for development loops, operational checks, and quick automation scripts.</p>
            <div className="rounded-xl border border-[#E7E5E0] bg-white p-6">
              <ul className="space-y-2">
                {CLI_COMMANDS.map((command) => (
                  <li key={command} className="rounded-md border border-[#E7E5E0] bg-white px-3 py-2 font-mono text-xs text-[#1C1B19] sm:text-sm">
                    {command}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
