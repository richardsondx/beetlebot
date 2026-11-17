"use client";

import { useEffect, useState, type RefObject } from "react";
import { ArrowUpIcon, PlusIcon } from "@/components/ui/icons";

/** Rounded composer (§4.1): + Add, Muse Spark label, 32px accent send circle. */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  sentCount,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  // Kept for call-site compatibility; the mode picker is not part of the §4.1 composer.
  mode?: unknown;
  onModeChange?: unknown;
  sentCount: number;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setIsPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <div className="bg-white px-4 pb-4 pt-2 md:px-2 md:pb-6">
      <form
        className="mx-auto flex w-full max-w-3xl flex-col rounded-3xl border border-[#D6D3CC] bg-white shadow-md focus-within:border-[#C8811A]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!streaming) onSend();
        }}
      >
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, isPhone ? 120 : 192)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isPhone) {
              e.preventDefault();
              if (!streaming) onSend();
            }
            if (e.key === "Escape") {
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          placeholder="Ask Beetlebot to plan something…"
          rows={1}
          aria-label="Message Beetlebot"
          className="min-w-0 resize-none bg-transparent px-4 pb-1 pt-3 text-[15px] leading-[22px] text-[#1C1B19] placeholder-[#9A968F] outline-none"
          style={{ maxHeight: isPhone ? "120px" : "192px" }}
        />
        <div className="flex items-center gap-1 px-3 pb-3 pt-1">
          <button
            type="button"
            aria-label="Add"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#6B6862] transition-all hover:bg-[#F2F1EE] hover:text-[#1C1B19] active:scale-[0.97]"
          >
            <PlusIcon size={16} />
          </button>
          <span className="ml-1 text-xs font-medium text-[#9A968F]">Muse Spark</span>
          <span className="flex-1" />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F2F1EE] text-[#1C1B19] transition-all hover:bg-[#E7E5E0] active:scale-[0.97]"
            >
              <span className="block h-3 w-3 rounded-[2px] bg-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!value.trim()}
              aria-label="Send"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C8811A] text-white transition-all hover:bg-[#A96B12] active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-[#E7E5E0] disabled:text-[#9A968F]"
            >
              <ArrowUpIcon size={18} strokeWidth={2.25} />
            </button>
          )}
        </div>
      </form>
      <p className="mt-2 text-center text-xs text-[#9A968F]">
        {sentCount < 3 ? "Enter to send · Shift+Enter for new line" : "Beetlebot plans, you book with the airline or hotel."}
      </p>
    </div>
  );
}
