import Link from "next/link";
import { NavLink } from "@/components/ui/nav-link";

const showDebug = process.env.BEETLEBOT_DEBUG !== "false";

const nav = [
  { href: "/chat", label: "Chat" },
  { href: "/autopilots", label: "Autopilots" },
  { href: "/packs", label: "Packs" },
  { href: "/calendar", label: "Calendar" },
  { href: "/audit", label: "Activity" },
  { href: "/settings", label: "Settings" },
  ...(showDebug ? [{ href: "/debug", label: "Debug" }] : []),
];

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#060b12] text-slate-100">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/8 px-4">
        <Link
          href="/"
          className="mr-2 flex shrink-0 items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-300/15"
        >
          <span>🪲</span>
          <span>beetlebot</span>
        </Link>
        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide [&>a]:shrink-0">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>
      </header>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
