"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import {
  ActivityIcon,
  BlocksIcon,
  BugIcon,
  CalendarDaysIcon,
  MessageCircleIcon,
  SettingsIcon,
  ZapIcon,
} from "@/components/ui/icons";

type NavItem = { href: string; label: string; Icon: (p: { size?: number; className?: string }) => React.ReactNode };

const NAV: NavItem[] = [
  { href: "/chat", label: "Chat", Icon: MessageCircleIcon },
  { href: "/autopilots", label: "Autopilots", Icon: ZapIcon },
  { href: "/packs", label: "Packs", Icon: BlocksIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarDaysIcon },
  { href: "/audit", label: "Activity", Icon: ActivityIcon },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/chat") return pathname === "/chat" || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1C1B19] px-2 py-1.5 text-xs font-medium text-white opacity-0 shadow-md transition-opacity delay-300 duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
      {label}
    </span>
  );
}

export function Sidebar({ showDebug }: { showDebug: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="hidden w-16 shrink-0 flex-col items-center border-r border-[#E7E5E0] bg-[#F7F7F5] py-4 md:flex"
    >
      <Link href="/chat" aria-label="Beetlebot home" className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] text-[#C8811A] transition-colors hover:bg-[#F2F1EE]">
        <Logo size={32} />
      </Link>
      <div className="flex flex-1 flex-col items-center gap-1">
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`group relative flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors duration-150 ${
                active ? "bg-[#FBF1E1] text-[#8A5710]" : "text-[#6B6862] hover:bg-[#F2F1EE] hover:text-[#1C1B19]"
              }`}
            >
              {active && (
                <span className="absolute -left-[13px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#C8811A]" aria-hidden="true" />
              )}
              <Icon size={20} />
              <Tooltip label={label} />
            </Link>
          );
        })}
      </div>
      <div className="flex flex-col items-center gap-1">
        {showDebug && (
          <Link
            href="/debug"
            aria-label="Debug"
            aria-current={pathname === "/debug" ? "page" : undefined}
            className={`group relative flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors duration-150 ${
              pathname === "/debug" ? "bg-[#FBF1E1] text-[#8A5710]" : "text-[#6B6862] hover:bg-[#F2F1EE] hover:text-[#1C1B19]"
            }`}
          >
            <BugIcon size={20} />
            <Tooltip label="Debug" />
          </Link>
        )}
        <Link
          href="/settings"
          aria-label="Settings"
          aria-current={pathname === "/settings" ? "page" : undefined}
          className={`group relative flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors duration-150 ${
            pathname === "/settings" ? "bg-[#FBF1E1] text-[#8A5710]" : "text-[#6B6862] hover:bg-[#F2F1EE] hover:text-[#1C1B19]"
          }`}
        >
          <SettingsIcon size={20} />
          <Tooltip label="Settings" />
        </Link>
        <span
          className="group relative mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#FBF1E1] text-sm font-semibold text-[#8A5710]"
          role="img"
          aria-label="Richardson"
        >
          R
          <Tooltip label="Richardson" />
        </span>
      </div>
    </nav>
  );
}
