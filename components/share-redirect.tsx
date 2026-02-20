"use client";

import { useEffect } from "react";

export function ShareRedirect({
  to,
  delayMs = 50,
}: {
  to: string;
  delayMs?: number;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.assign(to);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [to, delayMs]);

  return null;
}

