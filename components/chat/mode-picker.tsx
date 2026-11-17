"use client";

import { useEffect, useRef, useState } from "react";
import { CHAT_MODES, type ModeDefinition } from "@/lib/constants";

/** Mode pill: popover on desktop, bottom sheet on a phone. */
export function ModePicker({
  active,
  onChange,
}: {
  active: ModeDefinition;
  onChange: (mode: ModeDefinition) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  const list = (
    <div className="p-1.5">
      {CHAT_MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => {
            onChange(m);
            setOpen(false);
          }}
          className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
            active.id === m.id ? "bg-white/8" : "hover:bg-white/5"
          }`}
        >
          <span className="mt-0.5 text-base leading-none">{m.icon}</span>
          <div className="min-w-0">
            <p
              className={`text-sm font-medium ${
                active.id === m.id ? "text-slate-100" : "text-slate-300"
              }`}
            >
              {m.label}
              {active.id === m.id && (
                <span className="ml-1.5 text-xs font-normal text-slate-500">active</span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{m.description}</p>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Planning mode: ${active.label}`}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-all ${
          open
            ? active.activeColor
            : "border-white/10 bg-white/4 text-slate-400 hover:border-white/20 hover:text-slate-200"
        }`}
      >
        <span>{active.icon}</span>
        <span>{active.label}</span>
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 12 12"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <>
          {/* Desktop popover */}
          <div className="absolute bottom-full left-0 z-30 mb-2 hidden w-64 overflow-hidden rounded-xl border border-white/12 bg-[#0d1826] shadow-2xl shadow-black/50 sm:block">
            <div className="border-b border-white/8 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Planning mode
              </p>
            </div>
            {list}
          </div>
          {/* Phone bottom sheet */}
          <div className="fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-2xl border border-white/12 bg-[#0d1826] shadow-2xl shadow-black/60 sm:hidden">
            <div className="border-b border-white/8 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Planning mode
              </p>
            </div>
            {list}
          </div>
        </>
      )}
    </div>
  );
}
