"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ImageCard,
  ImageGallery,
  OptionSet,
  RichBlock,
} from "@/lib/chat/rich-message";

// ── Mode definitions ────────────────────────────────────────────────────────

import { MODES, type ModeDefinition } from "@/lib/constants";

type ChatMode = ModeDefinition;

const DEFAULT_MODE = MODES[0];

// ── Quick actions ───────────────────────────────────────────────────────────

const quickActions = [
  {
    title: "Plan my Friday",
    subtitle: "Find a fun evening plan under your current budget.",
    icon: "🎉",
  },
  {
    title: "Empty weekend detector",
    subtitle: "If Saturday is open by noon, auto-propose a full day.",
    icon: "📅",
  },
  {
    title: "Date night autopilot",
    subtitle: "Weekly soft hold + two curated options with fallback.",
    icon: "💫",
  },
  {
    title: "Rainy day replan",
    subtitle: "Swap outdoor activities with indoor alternatives.",
    icon: "🌧️",
  },
];

// ── Message type ────────────────────────────────────────────────────────────

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  blocks?: RichBlock[];
  mode?: string;
};

// ── Sub-components ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-base">
        🪲
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-[#131c2e] px-4 py-3">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function ModeDropdown({
  active,
  onChange,
}: {
  active: ChatMode;
  onChange: (mode: ChatMode) => void;
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
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
        <div className="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-xl border border-white/12 bg-[#0d1826] shadow-2xl shadow-black/50">
          <div className="border-b border-white/8 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Planning mode
            </p>
          </div>
          <div className="p-1.5">
            {MODES.map((m) => (
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
                      <span className="ml-1.5 text-xs font-normal text-slate-500">
                        active
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{m.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Category icon map ────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  restaurant: "🍽️",
  hotel: "🏨",
  park: "🌳",
  activity: "🎯",
  destination: "📍",
  experience: "✨",
  bar: "🍸",
  cafe: "☕",
  museum: "🏛️",
  event: "🎪",
  spa: "🧖",
  shopping: "🛍️",
};

function categoryIcon(category?: string): string {
  if (!category) return "📍";
  const key = category.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(k)) return v;
  }
  return "📍";
}

// ── Image card ──────────────────────────────────────────────────────────────

function ImageCardView({
  card,
  index,
  category,
  onSelect,
}: {
  card: ImageCard;
  index?: number;
  category?: string;
  onSelect?: (card: ImageCard) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasRealImage = card.imageUrl && !card.imageUrl.includes("placehold.co") && !imgFailed;

  return (
    <div className="group overflow-hidden rounded-2xl border border-white/8 bg-[#0d1422] transition-all duration-200 hover:border-amber-300/20 hover:shadow-xl hover:shadow-black/50">
      {/* Image area */}
      <div className="relative aspect-[5/3] w-full overflow-hidden bg-gradient-to-br from-[#0a111e] to-[#111d30]">
        {/* Index badge */}
        {index !== undefined && (
          <div className="absolute left-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white backdrop-blur-md ring-1 ring-white/10">
            {index}
          </div>
        )}

        {/* Category pill */}
        {category && (
          <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-md ring-1 ring-white/10">
            <span className="text-xs">{categoryIcon(category)}</span>
            <span className="text-[10px] capitalize text-slate-300">{category}</span>
          </div>
        )}

        {hasRealImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.imageUrl}
            alt={card.alt ?? card.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          /* Stylised placeholder with gradient + icon */
          <div className="flex h-full w-full flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-3xl ring-1 ring-white/8">
              {categoryIcon(category)}
            </div>
            <span className="max-w-[80%] text-center text-xs text-slate-500 leading-snug">
              {card.title}
            </span>
          </div>
        )}

        {/* Bottom gradient for text overlay readability */}
        {hasRealImage && (
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0d1422]/90 to-transparent" />
        )}
      </div>

      {/* Content area */}
      <div className="p-3.5">
        <p className="text-sm font-semibold text-slate-100 leading-snug">
          {card.title}
        </p>
        {card.subtitle && (
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            {card.subtitle}
          </p>
        )}

        {/* Meta chips */}
        {card.meta && Object.keys(card.meta).length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {Object.entries(card.meta).map(([, value]) => (
              <span
                key={value}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-slate-300"
              >
                {value}
              </span>
            ))}
          </div>
        )}

        {/* Actions row */}
        <div className="mt-3 flex items-center gap-2">
          {onSelect && (
            <button
              type="button"
              onClick={() => onSelect(card)}
              className="flex-1 rounded-lg bg-amber-400/15 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-400/25 active:scale-95"
            >
              Choose this
            </button>
          )}
          {card.actionUrl && (
            <a
              href={card.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
            >
              View
              <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 10L10 2M6 2h4v4" />
              </svg>
            </a>
          )}
          {card.sourceName && (
            <span className="ml-auto rounded-md bg-white/4 px-1.5 py-0.5 text-[10px] text-slate-600">
              {card.sourceName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Gallery (horizontal scroll) ─────────────────────────────────────────────

function GalleryView({
  gallery,
  onSelect,
}: {
  gallery: ImageGallery;
  onSelect?: (card: ImageCard) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative mt-3 -mx-1">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-hide"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {gallery.items.map((card, i) => (
          <div
            key={`${card.title}-${i}`}
            className="w-64 shrink-0"
            style={{ scrollSnapAlign: "start" }}
          >
            <ImageCardView card={card} index={i + 1} onSelect={onSelect} />
          </div>
        ))}
      </div>
      {gallery.items.length > 2 && (
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-[#131c2e] to-transparent" />
      )}
    </div>
  );
}

// ── Option set (numbered grid) ───────────────────────────────────────────────

type RawOption = {
  title: string;
  subtitle?: string;
  category?: string;
  meta?: Record<string, string>;
  actionUrl?: string;
  sourceName?: string;
};

function OptionSetView({
  optionSet,
  onSelect,
}: {
  optionSet: OptionSet;
  onSelect?: (card: ImageCard) => void;
}) {
  return (
    <div className="mt-3">
      {optionSet.prompt && (
        <p className="mb-3 text-xs font-medium text-slate-500">{optionSet.prompt}</p>
      )}
      <div
        className={`grid gap-3 ${
          optionSet.items.length === 1
            ? "grid-cols-1"
            : optionSet.items.length === 2
              ? "grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2"
        }`}
      >
        {optionSet.items.map(({ index, card }) => (
          <ImageCardView
            key={`${index}-${card.title}`}
            card={card}
            index={index}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

// ── Inline suggestion fallback (when text contains raw JSON) ─────────────────

type ParsedSuggestions = {
  text: string;
  options: RawOption[];
} | null;

function tryParseInlineSuggestions(raw: string): ParsedSuggestions {
  const braceIdx = raw.indexOf("{");
  if (braceIdx === -1) return null;
  const candidates = [raw.trim(), raw.slice(braceIdx)];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { text?: unknown; options?: unknown };
      if (
        typeof parsed.text === "string" &&
        Array.isArray(parsed.options) &&
        parsed.options.length > 0
      ) {
        return {
          text: parsed.text,
          options: parsed.options as RawOption[],
        };
      }
    } catch {
      // continue
    }
  }
  return null;
}

function InlineSuggestionsView({
  parsed,
  preamble,
  onSelect,
}: {
  parsed: ParsedSuggestions;
  preamble?: string;
  onSelect?: (card: ImageCard) => void;
}) {
  if (!parsed) return null;
  return (
    <div>
      {preamble && (
        <p className="whitespace-pre-wrap text-slate-100">{preamble}</p>
      )}
      <p className="whitespace-pre-wrap text-slate-100 mt-0">{parsed.text}</p>
      <div className="mt-3">
        <p className="mb-3 text-xs font-medium text-slate-500">Here are your options — tap one to explore further:</p>
        <div className={`grid gap-3 ${parsed.options.length === 1 ? "grid-cols-1" : parsed.options.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
          {parsed.options.map((opt, i) => {
            const card: ImageCard = {
              type: "image_card",
              title: opt.title,
              subtitle: opt.subtitle,
              imageUrl: `https://placehold.co/600x360/0d1826/4a7fbd?text=${encodeURIComponent(opt.title.slice(0, 24))}`,
              alt: opt.title,
              meta: opt.meta,
              actionUrl: opt.actionUrl,
              sourceName: opt.sourceName,
            };
            return (
              <ImageCardView
                key={`inline-${i}-${opt.title}`}
                card={card}
                index={i + 1}
                category={opt.category}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Rich block renderer ──────────────────────────────────────────────────────

function RichBlockRenderer({
  block,
  onSelect,
}: {
  block: RichBlock;
  onSelect?: (card: ImageCard) => void;
}) {
  switch (block.type) {
    case "text_block":
      return (
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {block.text}
        </p>
      );
    case "image_card":
      return (
        <div className="mt-3 max-w-xs">
          <ImageCardView card={block} onSelect={onSelect} />
        </div>
      );
    case "image_gallery":
      return <GalleryView gallery={block} onSelect={onSelect} />;
    case "option_set":
      return <OptionSetView optionSet={block} onSelect={onSelect} />;
    default:
      return null;
  }
}

// ── Assistant message body ────────────────────────────────────────────────────

function AssistantMessageBody({
  message,
  onSelect,
}: {
  message: ChatMessage;
  onSelect?: (card: ImageCard) => void;
}) {
  const hasBlocks = message.blocks && message.blocks.length > 0;

  // Happy path: structured blocks came through correctly
  if (hasBlocks) {
    return (
      <>
        <p className="whitespace-pre-wrap text-slate-100">{message.text}</p>
        {message.blocks!.map((block, bi) => (
          <RichBlockRenderer key={bi} block={block} onSelect={onSelect} />
        ))}
      </>
    );
  }

  // Fallback: text contains embedded JSON with suggestions (parsing failed upstream)
  const parsed = tryParseInlineSuggestions(message.text);
  if (parsed) {
    const braceIdx = message.text.indexOf("{");
    const preamble = braceIdx > 0 ? message.text.slice(0, braceIdx).trim() : undefined;
    return <InlineSuggestionsView parsed={parsed} preamble={preamble} onSelect={onSelect} />;
  }

  // Plain text
  return <p className="whitespace-pre-wrap text-slate-100">{message.text}</p>;
}

// ── Main component ───────────────────────────────────────────────────────────

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<ChatMode>(DEFAULT_MODE);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasMessages = messages.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    try {
      const savedModeId = window.localStorage.getItem("beetlebot.chat.mode");
      const savedThreadId = window.localStorage.getItem("beetlebot.chat.threadId");
      if (savedModeId) {
        const found = MODES.find((m) => m.id === savedModeId);
        if (found) setActiveMode(found);
      }
      if (savedThreadId && savedThreadId.length >= 8) {
        setThreadId(savedThreadId);
      }
    } catch {
      // Ignore localStorage access issues (private mode, denied storage, etc).
    } finally {
      // Prevent initial default state from clobbering saved preferences.
      setStorageHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!storageHydrated) return;
    try {
      window.localStorage.setItem("beetlebot.chat.mode", activeMode.id);
    } catch {
      // Ignore localStorage access issues.
    }
  }, [activeMode.id, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated) return;
    try {
      if (threadId) {
        window.localStorage.setItem("beetlebot.chat.threadId", threadId);
      } else {
        window.localStorage.removeItem("beetlebot.chat.threadId");
      }
    } catch {
      // Ignore localStorage access issues.
    }
  }, [threadId, storageHydrated]);

  function handleCardSelect(card: ImageCard) {
    const msg = card.actionUrl
      ? `I'd like to go with "${card.title}". Here's the link: ${card.actionUrl}`
      : `I'd like to go with "${card.title}".`;
    void submitMessage(msg);
  }

  async function submitMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: trimmed, mode: activeMode.id },
    ]);
    setInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          mode: activeMode.id,
          threadId: threadId ?? undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const payload = (await response.json()) as {
        data?: {
          reply?: string;
          blocks?: RichBlock[];
          fallbackPlan?: string;
          threadId?: string;
        };
        error?: string;
      };
      if (!response.ok || !payload.data?.reply) {
        throw new Error(payload.error ?? "Unable to process message.");
      }

      const fallbackText = payload.data.fallbackPlan
        ? `\n\nFallback plan: ${payload.data.fallbackPlan}`
        : "";
      if (payload.data.threadId && payload.data.threadId.length >= 8) {
        setThreadId(payload.data.threadId);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `${payload.data!.reply}${fallbackText}`,
          blocks: payload.data!.blocks,
        },
      ]);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unknown error",
      );
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitMessage(input);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {!hasMessages ? (
          <div className="flex h-full flex-col items-center justify-center gap-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/15 text-4xl shadow-lg shadow-amber-400/10">
                🪲
              </div>
              <h2 className="text-2xl font-semibold text-white">
                How can I help you today?
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Autonomous planning for your social life.
              </p>
            </div>
            <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => void submitMessage(action.title)}
                  className="group rounded-xl border border-white/8 bg-[#0d1422] p-4 text-left transition-all hover:border-amber-300/30 hover:bg-[#111d30]"
                >
                  <div className="mb-2 text-2xl">{action.icon}</div>
                  <p className="text-sm font-medium text-white">
                    {action.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {action.subtitle}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {messages.map((message, idx) => (
              <div
                key={`${message.role}-${idx}`}
                className={`flex items-start gap-3 ${
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-base">
                    🪲
                  </div>
                )}
                <div
                  className={`min-w-0 ${
                    message.role === "user" ? "max-w-[75%]" : "flex-1"
                  }`}
                >
                  {message.role === "user" ? (
                    /* User bubble */
                    <div className="rounded-2xl rounded-br-sm bg-amber-400/20 px-4 py-3 text-sm leading-relaxed text-amber-50">
                      {message.mode && message.mode !== "explore" && (
                        <p className="mb-1.5 text-xs text-amber-300/60">
                          {MODES.find((m) => m.id === message.mode)?.icon}{" "}
                          {MODES.find((m) => m.id === message.mode)?.label}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{message.text}</p>
                    </div>
                  ) : (
                    /* Assistant bubble — may contain rich blocks or inline suggestions */
                    <div className="rounded-2xl rounded-bl-sm bg-[#131c2e] px-4 py-3 text-sm leading-relaxed">
                      <AssistantMessageBody
                        message={message}
                        onSelect={handleCardSelect}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && <TypingIndicator />}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-white/8 bg-[#060b12]/80 px-4 py-4 backdrop-blur-sm">
        <form
          className="mx-auto flex max-w-3xl flex-col rounded-2xl border border-white/10 bg-[#0d1422] shadow-xl shadow-black/30 focus-within:border-amber-300/25"
          onSubmit={(e) => {
            e.preventDefault();
            void submitMessage(input);
          }}
        >
          {/* Text row */}
          <div className="flex items-end gap-3 px-4 pt-3 pb-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Plan my Friday under $120 with indoor options…"
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
              style={{ maxHeight: "160px" }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-[#060b12] transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M8 2a.75.75 0 0 1 .75.75v8.69l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V2.75A.75.75 0 0 1 8 2Z" />
              </svg>
            </button>
          </div>

          {/* Mode row */}
          <div className="flex items-center gap-2 border-t border-white/6 px-4 py-2">
            <ModeDropdown active={activeMode} onChange={setActiveMode} />
            <div className="h-3.5 w-px bg-white/8" />
            <p className="text-xs text-slate-600">{activeMode.description}</p>
          </div>
        </form>

        <p className="mt-2 text-center text-xs text-slate-600">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
