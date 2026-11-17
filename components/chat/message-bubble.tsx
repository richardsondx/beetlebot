import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

/** User bubble (§4.1): right-aligned, max 80%, surface-muted, tail corner 6. */
export function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[80%] rounded-[18px] rounded-br-[6px] bg-[#F2F1EE] px-3.5 py-2.5 text-[15px] leading-[22px] text-[#1C1B19]">
      {children}
    </div>
  );
}

/** Assistant message (§4.1): no bubble, plain text with a 24px logo avatar left. */
export function AssistantMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FBF1E1] text-[#C8811A]">
        <Logo size={24} />
      </span>
      <div className="min-w-0 flex-1 text-[15px] leading-[22px] text-[#1C1B19]">{children}</div>
    </div>
  );
}

/** Thinking state (§4.1): three pulsing dots, text-faint. */
export function ThinkingDots() {
  return (
    <span className="flex items-center gap-1.5 py-2" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-pulse rounded-full bg-[#9A968F]"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
    </span>
  );
}
