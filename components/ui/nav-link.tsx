"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLinkProps = {
  href: string;
  label: string;
};

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname();
  const isActive =
    href === "/chat" ? pathname === "/chat" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
        isActive
          ? "bg-[#F2F1EE] text-[#1C1B19]"
          : "text-[#6B6862] hover:bg-[#F2F1EE] hover:text-[#1C1B19]"
      }`}
    >
      {label}
    </Link>
  );
}
