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
      "Use Explore, Date Night, Family, Social, Relax, Travel, or Focus to shape planning behavior and output style.",
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
    <div className="min-h-screen bg-[#060b12] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#060b12]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 text-amber-200">
            <span className="text-lg">🪲</span>
            <span className="text-base font-semibold tracking-tight">beetlebot docs</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <a
              href="https://github.com/richardsondx/beetlebot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 transition-colors hover:text-slate-200"
            >
              GitHub
            </a>
            <a
              href="https://discord.gg/TWuKqaZxuc"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-amber-200 transition-colors hover:bg-amber-300/20"
            >
              Join Discord
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-xl border border-white/[0.08] bg-[#0b1220] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">On this page</p>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <div className="space-y-12">
          <section className="rounded-2xl border border-white/[0.08] bg-[#0b1220] p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/80">Documentation</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Build with Beetlebot fast
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
              This guide is designed for speed: get running, understand the core primitives, connect integrations, and
              ship confidently with clear API and CLI references.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <a
                href="#quickstart"
                className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-slate-200 transition-colors hover:bg-white/[0.08]"
              >
                Start in 3 steps
              </a>
              <a
                href="#api"
                className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-slate-200 transition-colors hover:bg-white/[0.08]"
              >
                API reference
              </a>
              <a
                href="#cli"
                className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-slate-200 transition-colors hover:bg-white/[0.08]"
              >
                CLI commands
              </a>
            </div>
          </section>

          <section id="quickstart" className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Quickstart</h2>
            <p className="text-slate-300">
              If you only do one thing, do this section. It gets your local setup working with minimal friction.
            </p>
            <div className="space-y-4">
              {QUICKSTART_STEPS.map((step, idx) => (
                <article key={step.title} className="rounded-xl border border-white/[0.08] bg-[#0b1220] p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Step {idx + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{step.title}</h3>
                  <pre className="mt-3 overflow-x-auto rounded-lg border border-white/[0.06] bg-[#060b12] p-4 text-sm text-slate-200">
                    <code>{step.command}</code>
                  </pre>
                  <p className="mt-3 text-sm text-slate-400">{step.note}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="concepts" className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Core concepts</h2>
            <p className="text-slate-300">
              These building blocks explain how Beetlebot behaves and where to customize your workflow.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {CORE_CONCEPTS.map((concept) => (
                <article key={concept.title} className="rounded-xl border border-white/[0.08] bg-[#0b1220] p-5">
                  <h3 className="text-lg font-semibold text-white">{concept.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{concept.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="integrations" className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Integrations</h2>
            <div className="rounded-xl border border-white/[0.08] bg-[#0b1220] p-6">
              <p className="text-sm leading-relaxed text-slate-300">
                Connect Google Calendar, Telegram, or WhatsApp from <strong className="text-slate-100">Settings</strong>{" "}
                in the app, or use CLI commands for scripted setup. Credentials are encrypted at rest in your local
                database.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-lg border border-white/[0.06] bg-[#060b12] p-4 text-sm text-slate-200">
                <code>
                  {"beetlebot integrations list\nbeetlebot integrations connect google_calendar\nbeetlebot integrations connect telegram"}
                </code>
              </pre>
            </div>
          </section>

          <section id="api" className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">API reference</h2>
            <p className="text-slate-300">Most teams begin with chat and autopilot endpoints, then layer calendar and memory flows.</p>
            <div className="space-y-4">
              {API_GROUPS.map((group) => (
                <article key={group.area} className="rounded-xl border border-white/[0.08] bg-[#0b1220] p-5">
                  <h3 className="text-lg font-semibold text-white">{group.area}</h3>
                  <ul className="mt-3 space-y-2">
                    {group.endpoints.map((endpoint) => (
                      <li key={endpoint} className="rounded-md border border-white/[0.06] bg-[#060b12] px-3 py-2 font-mono text-xs text-slate-200 sm:text-sm">
                        {endpoint}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section id="cli" className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">CLI</h2>
            <p className="text-slate-300">Use the CLI for development loops, operational checks, and quick automation scripts.</p>
            <div className="rounded-xl border border-white/[0.08] bg-[#0b1220] p-6">
              <ul className="space-y-2">
                {CLI_COMMANDS.map((command) => (
                  <li key={command} className="rounded-md border border-white/[0.06] bg-[#060b12] px-3 py-2 font-mono text-xs text-slate-200 sm:text-sm">
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
