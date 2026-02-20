import Link from "next/link";

const FEATURES = [
  {
    icon: "⚡",
    title: "Autopilots",
    headline: "Set a goal. It runs itself.",
    description:
      '"Empty Weekend + Weather" fires every Friday at noon. If Saturday is open and rain is coming, Beetlebot books an indoor plan — before you even think about it.',
  },
  {
    icon: "📦",
    title: "Packs",
    headline: "Community-curated planning skills.",
    description:
      "Toronto Date Night Pack. Rainy Day Rescue. Your city, your vibe — install a pack or build your own. Every city deserves a local expert.",
  },
  {
    icon: "🎭",
    title: "Modes",
    headline: "Context shapes everything.",
    description:
      "Date night. Family. Social. Travel. Relax. Focus. Switch modes and the entire agent adapts — different priorities, different actions, same intelligence.",
  },
  {
    icon: "🛡️",
    title: "Smart guardrails",
    headline: "Autonomous, not reckless.",
    description:
      "You decide what runs fully on autopilot and what needs a thumbs-up. Full audit trail on every action. The beetle moves fast — but only as fast as you let it.",
  },
];

const COMPARISONS = [
  {
    label: "General AI chatbots",
    vibe: "dull",
    text: "You ask. They answer. You still plan everything yourself. No calendar. No budget. No follow-through. Just text in a box.",
  },
  {
    label: "Recommendation apps",
    vibe: "dull",
    text: 'They suggest. You scroll. Same restaurants. Same lists. Zero awareness of your schedule, your weather, or your wallet. "Here are 47 brunch spots."',
  },
  {
    label: "Beetlebot",
    vibe: "bright",
    text: "Plans autonomously. Reads your calendar. Knows the season. Watches the weather. Tracks your budget. Then actually follows through.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#060b12] text-slate-100">
      {/* ─── Floating nav ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/[0.06] bg-[#060b12]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5 text-amber-200">
            <span className="text-xl">🪲</span>
            <span className="text-lg font-bold tracking-tight">beetlebot</span>
          </div>
          <div className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-slate-200">
              How it works
            </a>
            <a href="#colony" className="transition-colors hover:text-slate-200">
              The Colony
            </a>
            <a
              href="https://github.com/richardsondx/beetlebot"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-slate-200"
            >
              GitHub
            </a>
            <a
              href="https://discord.gg/TWuKqaZxuc"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-slate-200"
            >
              Discord
            </a>
          </div>
          <Link
            href="/chat"
            className="rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-[#060b12] transition-all hover:bg-amber-300 hover:shadow-lg hover:shadow-amber-400/20"
          >
            Launch Beetlebot
          </Link>
        </div>
      </nav>

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-20">
        {/* Radial glow behind the beetle */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/[0.04] blur-[120px]" />

        <div className="landing-fade-in relative z-10 mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-4 py-1.5 text-sm text-amber-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 landing-pulse" />
            Open source &middot; Autonomous &middot; Community-driven
          </div>

          {/* Beetle icon */}
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-400/10 text-5xl shadow-2xl shadow-amber-400/10 ring-1 ring-amber-300/20">
            🪲
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Your free time
            <br />
            <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
              deserves an autopilot.
            </span>
          </h1>

          {/* Sub */}
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            The open-source AI that autonomously plans your life — date nights,
            weekend adventures, rainy day rescues. It reads your calendar, knows
            the season, watches the weather, and handles the rest.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/chat"
              className="group flex items-center gap-2 rounded-full bg-amber-400 px-7 py-3.5 text-base font-semibold text-[#060b12] transition-all hover:bg-amber-300 hover:shadow-xl hover:shadow-amber-400/25"
            >
              Start planning
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 16 16"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h10m-4-4 4 4-4 4" />
              </svg>
            </Link>
            <a
              href="https://discord.gg/TWuKqaZxuc"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-7 py-3.5 text-base font-medium text-slate-300 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              Join the Colony
              <svg className="h-4 w-4 opacity-60" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 landing-bounce">
          <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* ─── Not another chatbot ──────────────────────────────────────── */}
      <section className="relative border-t border-white/[0.04] py-28 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Not another chatbot.
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Other tools give you text. Beetlebot gives you your time back.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {COMPARISONS.map((item) => (
              <div
                key={item.label}
                className={`relative overflow-hidden rounded-2xl border p-6 transition-all ${
                  item.vibe === "bright"
                    ? "border-amber-300/20 bg-amber-400/[0.04] shadow-xl shadow-amber-400/[0.06]"
                    : "border-white/[0.06] bg-white/[0.02]"
                }`}
              >
                {item.vibe === "bright" && (
                  <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-amber-400/[0.08] blur-3xl" />
                )}
                <p
                  className={`relative text-xs font-semibold uppercase tracking-widest ${
                    item.vibe === "bright" ? "text-amber-300" : "text-slate-600"
                  }`}
                >
                  {item.label}
                </p>
                <p
                  className={`relative mt-4 text-base leading-relaxed ${
                    item.vibe === "bright" ? "text-slate-200" : "text-slate-500"
                  }`}
                >
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="relative border-t border-white/[0.04] py-28 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Set it. Forget it. Live it.
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Four primitives that turn an AI into your personal life assistant.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/10 text-2xl ring-1 ring-amber-300/20">
                  {feature.icon}
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/70">
                  {feature.title}
                </p>
                <h3 className="mt-2 text-xl font-bold text-white">
                  {feature.headline}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── The Colony ───────────────────────────────────────────────── */}
      <section id="colony" className="relative border-t border-white/[0.04] py-28 px-6">
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-amber-400/[0.02] blur-[100px]" />

        <div className="relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Built in the open. Shaped by the colony.
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Beetlebot isn&apos;t a product with a waitlist. It&apos;s a movement with a
              repo. The Colony is the community that believes free time
              shouldn&apos;t be wasted on planning free time.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-400/10 text-2xl ring-1 ring-violet-300/20">
                📦
              </div>
              <h3 className="text-lg font-bold text-white">Build Packs</h3>
              <p className="mt-2 text-sm text-slate-400">
                Create planning skills for your city. Share local knowledge
                globally. Every city deserves a local expert.
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-400/10 text-2xl ring-1 ring-sky-300/20">
                🗺️
              </div>
              <h3 className="text-lg font-bold text-white">Shape the roadmap</h3>
              <p className="mt-2 text-sm text-slate-400">
                The best features come from real people with real weekends. Open
                issues, open PRs, open conversations.
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-2xl ring-1 ring-emerald-300/20">
                🔓
              </div>
              <h3 className="text-lg font-bold text-white">Fork it. Own it.</h3>
              <p className="mt-2 text-sm text-slate-400">
                Open source means your agent, your rules. Self-host it, extend
                it, make it yours. No vendor lock-in. Ever.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Quickstart ───────────────────────────────────────────────── */}
      <section className="relative border-t border-white/[0.04] py-28 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Three commands. That&apos;s it.
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            From zero to your first plan in under a minute.
          </p>

          {/* Terminal */}
          <div className="mx-auto mt-12 max-w-lg overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0f1a] shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-white/10" />
              <div className="h-3 w-3 rounded-full bg-white/10" />
              <div className="h-3 w-3 rounded-full bg-white/10" />
              <span className="ml-2 text-xs text-slate-600">terminal</span>
            </div>
            <div className="px-6 py-5 text-left font-mono text-sm leading-loose">
              <p>
                <span className="text-amber-300">$</span>{" "}
                <span className="text-slate-300">
                  git clone github.com/richardsondx/beetlebot
                </span>
              </p>
              <p>
                <span className="text-amber-300">$</span>{" "}
                <span className="text-slate-300">cd beetlebot && npm install</span>
              </p>
              <p>
                <span className="text-amber-300">$</span>{" "}
                <span className="text-slate-300">npm run dev</span>
              </p>
              <p className="mt-3 text-emerald-400/70">
                🪲 beetlebot is alive on localhost:3000
              </p>
            </div>
          </div>

          {/* Resource links */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
            <a
              href="https://discord.gg/TWuKqaZxuc"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm text-slate-400 transition-all hover:border-white/[0.15] hover:text-white"
            >
              <svg className="h-5 w-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
              Discord
            </a>
            <a
              href="/docs"
              className="group flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm text-slate-400 transition-all hover:border-white/[0.15] hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              Documentation
            </a>
            <a
              href="https://github.com/richardsondx/beetlebot"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm text-slate-400 transition-all hover:border-white/[0.15] hover:text-white"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.04] py-24 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Your weekend is in{" "}
            <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
              {getDaysUntilWeekend()} days
            </span>
            .
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Do you have a plan? Beetlebot does.
          </p>
          <div className="mt-10">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-8 py-4 text-base font-semibold text-[#060b12] transition-all hover:bg-amber-300 hover:shadow-xl hover:shadow-amber-400/25"
            >
              Plan something
              <svg className="h-4 w-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h10m-4-4 4 4-4 4" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2 text-slate-500">
              <span className="text-lg">🪲</span>
              <span className="text-sm font-semibold tracking-tight">beetlebot</span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm text-slate-600">
              <a
                href="https://github.com/richardsondx/beetlebot"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-slate-400"
              >
                GitHub
              </a>
              <a
                href="https://discord.gg/TWuKqaZxuc"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-slate-400"
              >
                Discord
              </a>
              <a href="/docs" className="transition-colors hover:text-slate-400">
                Docs
              </a>
            </div>
          </div>

          {/* Signature line */}
          <div className="mt-8 border-t border-white/[0.04] pt-8 text-center">
            <p className="text-sm text-slate-600">
              Handcrafted by{" "}
              <a
                href="https://x.com/richardsondx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 transition-colors hover:text-amber-300"
              >
                Richardson Dackam
              </a>{" "}
              while Beetlebot handled his weekends.
            </p>
            <p className="mt-1 text-xs text-slate-700">
              The beetle never sleeps. &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function getDaysUntilWeekend(): number {
  const today = new Date().getDay();
  if (today === 0) return 6; // Sunday -> next Saturday
  if (today === 6) return 0; // Saturday
  return 6 - today;
}
