"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";

export function greetingFor(date: Date, name: string): string {
  const hour = date.getHours();
  if (hour >= 17) return `Good evening, ${name}`;
  if (hour >= 12) return `Good afternoon, ${name}`;
  return `Good morning, ${name}`;
}

export function displayName(): string {
  try {
    return window.localStorage.getItem("beetlebot.displayName")?.trim() || "Richardson";
  } catch {
    return "Richardson";
  }
}

/** Serif greeting (§4.1), 36/44 desktop, 28/36 mobile. */
export function Greeting({ name }: { name?: string }) {
  const [resolved, setResolved] = useState(name ?? "Richardson");
  useEffect(() => {
    if (!name) setResolved(displayName());
  }, [name]);
  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-4 flex h-8 w-8 items-center justify-center text-[#C8811A]">
        <Logo size={32} />
      </span>
      <h1 className="font-serif text-[28px] leading-[36px] text-[#1C1B19] sm:text-[36px] sm:leading-[44px]">
        {greetingFor(new Date(), resolved)}
      </h1>
    </div>
  );
}
