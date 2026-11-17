"use client";

import { useEffect, useState, type RefObject } from "react";
import type { ModeDefinition } from "@/lib/constants";
import { ModePicker } from "./mode-picker";

/** One-row composer: mode pill, textarea, send or stop. */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  mode,
  onModeChange,
  sentCount,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  mode: ModeDefinition;
  onModeChange: (mode: ModeDefinition) => void;
  sentCount: number;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const [isPhone, setIsPhone] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setIsPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const showHint = hintVisible && sentCount < 3 && !isPhone;

  return (
    <div className="border-t border-white/8 bg-[#060b12]/80 px-4 py-4 backdrop-blur-sm">
      <form
        className="mx-auto flex max-w-3xl flex-col rounded-2xl border border-white/10 bg-[#0d1422] shadow-xl shadow-black/30 focus-within:border-amber-300/25"
        onSubmit={(e) => {
          e.preventDefault();
          if (!streaming) onSend();
        }}
      >
        <div className="flex items-end gap-2 px-3 pt-3 pb-2">
          <ModePicker active={mode} onChange={onModeChange} />
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, isPhone ? 120 : 160)}px`;
            }}
            onFocus={() => setHintVisible(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isPhone) {
                e.preventDefault();
                if (!streaming) onSend();
              }
            }}
            placeholder={isPhone ? "Ask Beetlebot" : "Ask about a trip, a dinner, or your weekend"}
            rows={1}
            aria-label="Message Beetlebot"
            className="min-w-0 flex-1 resize-none bg-transparent text-base text-slate-100 placeholder-slate-500 outline-none"
            style={{ maxHeight: isPhone ? "120px" : "160px" }}
          />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-200 transition-all hover:bg-white/15"
            >
              <span className="block h-3 w-3 rounded-[2px] bg-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!value.trim()}
              aria-label="Send"
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-[#060b12] transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 14V2m0 0-4 4m4-4 4 4"
                />
              </svg>
            </button>
          )}
        </div>
      </form>

      {showHint ? (
        <p className="mt-2 text-center text-xs text-slate-600">
          Enter to send · Shift+Enter for new line
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-slate-600">
          Beetlebot plans, you book with the airline or hotel.
        </p>
      )}
    </div>
  );
}
