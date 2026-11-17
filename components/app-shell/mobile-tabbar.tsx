"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ActivityIcon,
  BlocksIcon,
  BugIcon,
  CalendarDaysIcon,
  EllipsisIcon,
  MessageCircleIcon,
  SettingsIcon,
  XIcon,
  ZapIcon,
} from "@/components/ui/icons";

const TABS = [
  { href: "/chat", label: "Chat", Icon: MessageCircleIcon },
  { href: "/packs", label: "Packs", Icon: BlocksIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarDaysIcon },
  { href: "/audit", label: "Activity", Icon: ActivityIcon },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/chat") return pathname === "/chat" || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileTabbar({ showDebug }: { showDebug: boolean }) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const moreActive = ["/autopilots", "/settings", "/debug"].some(
    (h) => pathname === h || pathname.startsWith(`${h}/`),
  );
  return (
    <>
      <nav
        aria-label="Main"
        className="flex h-16 shrink-0 items-stretch justify-around border-t border-[#E7E5E0] bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                active ? "text-[#8A5710]" : "text-[#6B6862]"
              }`}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="More"
          aria-expanded={sheetOpen}
          className={`flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            moreActive ? "text-[#8A5710]" : "text-[#6B6862]"
          }`}
        >
          <EllipsisIcon size={20} />
          More
        </button>
      </nav>
      {sheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="More">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/20"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-[#E7E5E0] bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg transition-opacity duration-200">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[#6B6862]">More</p>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSheetOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[#6B6862] hover:bg-[#F2F1EE]"
              >
                <XIcon size={16} />
              </button>
            </div>
            {[
              { href: "/autopilots", label: "Autopilots", Icon: ZapIcon },
              { href: "/settings", label: "Settings", Icon: SettingsIcon },
              ...(showDebug ? [{ href: "/debug", label: "Debug", Icon: BugIcon }] : []),
            ].map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setSheetOpen(false)}
                className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2 text-[15px] font-medium text-[#1C1B19] hover:bg-[#F2F1EE]"
              >
                <Icon size={20} className="text-[#6B6862]" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
