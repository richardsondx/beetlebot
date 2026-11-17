"use client";

import { useEffect, useRef, useState } from "react";
import type {
  FlightCard,
  FlightCompareBlock,
  FollowUp,
  HotelCard,
  HotelSetBlock,
  ImageCard,
  ImageGallery,
  OptionSet,
  RichBlock,
} from "@/lib/chat/rich-message";
import { formatMoney } from "@/lib/chat/rich-message";
import { ruleFollowUps } from "@/lib/chat/follow-ups";
import { streamChatResponse } from "@/hooks/use-chat-stream";
import { CHAT_MODES, DEFAULT_CHAT_MODE, type ModeDefinition } from "@/lib/constants";
import { Composer } from "@/components/chat/composer";
import { FollowUpChips } from "@/components/chat/follow-up-chips";
import { StatusLine } from "@/components/chat/status-line";
import { BlockSkeleton } from "@/components/chat/block-skeleton";
import { FlightCompareView } from "@/components/chat/blocks/flight-compare";
import { HotelSetView } from "@/components/chat/blocks/hotel-set";

type ChatMode = ModeDefinition;

// ── Quick actions ───────────────────────────────────────────────────────────

type QuickAction = {
  title: string;
  subtitle: string;
  icon: string;
  /** Fill the composer with this text instead of sending the title. */
  prompt?: string;
};

const quickActions: QuickAction[] = [
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
  {
    title: "Weekend trip",
    subtitle: "Compare live flights and hotels for a city break.",
    icon: "✈️",
    prompt: "Weekend in New York from Toronto, Fri to Mon, 1 adult",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert pack slug (e.g. marie/paris-hidden-gems) to friendly name (Paris Hidden Gems) */
function packSlugToFriendlyName(slug: string): string {
  const part = slug.replace(/^@/, "").split("/").pop() ?? slug;
  return part
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Message type ────────────────────────────────────────────────────────────

type ChatError = {
  code: string;
  message: string;
  retryable: boolean;
  requestId: string;
  fix?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  blocks?: RichBlock[];
  followUps?: FollowUp[];
  mode?: string;
  packsUsed?: string[];
  stopped?: boolean;
  /** Raw API response payload stored for debug inspection */
  _raw?: unknown;
};

// ── Sub-components ──────────────────────────────────────────────────────────

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
      <div className="relative aspect-[5/3] w-full overflow-hidden bg-gradient-to-br from-[#0a111e] to-[#111d30]">
        {index !== undefined && (
          <div className="absolute left-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white backdrop-blur-md ring-1 ring-white/10">
            {index}
          </div>
        )}
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
          <div className="flex h-full w-full flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-3xl ring-1 ring-white/8">
              {categoryIcon(category)}
            </div>
            <span className="max-w-[80%] text-center text-xs text-slate-500 leading-snug">
              {card.title}
            </span>
          </div>
        )}
        {hasRealImage && (
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0d1422]/90 to-transparent" />
        )}
      </div>
      <div className="p-3.5">
        <p className="text-sm font-semibold text-slate-100 leading-snug">{card.title}</p>
        {card.subtitle && (
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">{card.subtitle}</p>
        )}
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
        <div className="mt-3 flex items-center gap-2">
          {onSelect && (
            <button
              type="button"
              onClick={() => onSelect(card)}
              className="rounded-lg bg-amber-400/15 px-4 py-1.5 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-400/25 active:scale-[0.97]"
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
        </div>
        {card.sourceName && (
          <p className="mt-2.5 truncate text-[10px] text-slate-600">via {card.sourceName}</p>
        )}
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
  return (
    <div className="relative mt-3 -mx-1">
      <div
        className="flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-hide"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {gallery.items.map((card, i) => (
          <div key={`${card.title}-${i}`} className="w-64 shrink-0" style={{ scrollSnapAlign: "start" }}>
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
          <ImageCardView key={`${index}-${card.title}`} card={card} index={index} onSelect={onSelect} />
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
        <p className="whitespace-pre-wrap break-words text-slate-100">{preamble}</p>
      )}
      <p className="whitespace-pre-wrap break-words text-slate-100 mt-0">{parsed.text}</p>
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
  selectedFlight,
  selectedHotel,
  checkingHotelId,
  onSelectCard,
  onSelectFlight,
  onSelectHotel,
  onCheckHotelPrice,
  onRefreshFlights,
}: {
  block: RichBlock;
  selectedFlight?: string;
  selectedHotel?: string;
  checkingHotelId?: string;
  onSelectCard?: (card: ImageCard) => void;
  onSelectFlight?: (card: FlightCard, block: FlightCompareBlock) => void;
  onSelectHotel?: (hotel: HotelCard, block: HotelSetBlock) => void;
  onCheckHotelPrice?: (hotel: HotelCard) => void;
  onRefreshFlights?: () => void;
}) {
  switch (block.type) {
    case "text_block":
      return (
        <p className="mt-2 break-words text-sm leading-relaxed text-slate-300">{block.text}</p>
      );
    case "image_card":
      return (
        <div className="mt-3 max-w-xs">
          <ImageCardView card={block} onSelect={onSelectCard} />
        </div>
      );
    case "image_gallery":
      return <GalleryView gallery={block} onSelect={onSelectCard} />;
    case "option_set":
      return <OptionSetView optionSet={block} onSelect={onSelectCard} />;
    case "flight_compare":
      return (
        <FlightCompareView
          block={block}
          selectedOfferId={selectedFlight}
          onSelect={(card) => onSelectFlight?.(card, block)}
          onRefresh={() => onRefreshFlights?.()}
        />
      );
    case "hotel_set":
      return (
        <HotelSetView
          block={block}
          selectedHotelId={selectedHotel}
          checkingHotelId={checkingHotelId}
          onSelect={(hotel) => onSelectHotel?.(hotel, block)}
          onCheckPrice={(hotel) => onCheckHotelPrice?.(hotel)}
        />
      );
    default:
      return null;
  }
}

// ── JSON debug inspector ──────────────────────────────────────────────────────

function JsonInspector({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(false);
  const payload = {
    text: message.text,
    blocks: message.blocks,
    _raw: message._raw,
  };
  const json = JSON.stringify(payload, null, 2);
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Inspect raw JSON"
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono text-slate-600 opacity-0 transition-all hover:bg-white/5 hover:text-slate-400 group-hover/bubble:opacity-100"
      >
        <span>{open ? "▾" : "▸"}</span>
        <span>{"{}"}</span>
      </button>
      {open && (
        <div className="mt-1.5 overflow-x-auto rounded-xl border border-white/8 bg-[#070c14] p-3">
          <pre className="whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-slate-400">
            {json}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Assistant message body ────────────────────────────────────────────────────

function AssistantMessageBody({
  message,
  selectedFlight,
  selectedHotel,
  checkingHotelId,
  onSelectCard,
  onSelectFlight,
  onSelectHotel,
  onCheckHotelPrice,
  onRefreshFlights,
}: {
  message: ChatMessage;
  selectedFlight?: string;
  selectedHotel?: string;
  checkingHotelId?: string;
  onSelectCard?: (card: ImageCard) => void;
  onSelectFlight?: (card: FlightCard, block: FlightCompareBlock) => void;
  onSelectHotel?: (hotel: HotelCard, block: HotelSetBlock) => void;
  onCheckHotelPrice?: (hotel: HotelCard) => void;
  onRefreshFlights?: () => void;
}) {
  const hasBlocks = message.blocks && message.blocks.length > 0;

  if (hasBlocks) {
    return (
      <>
        {message.text && (
          <p className="whitespace-pre-wrap break-words text-slate-100">{message.text}</p>
        )}
        {message.blocks!.map((block, bi) => (
          <RichBlockRenderer
            key={`${block.type}-${bi}`}
            block={block}
            selectedFlight={selectedFlight}
            selectedHotel={selectedHotel}
            checkingHotelId={checkingHotelId}
            onSelectCard={onSelectCard}
            onSelectFlight={onSelectFlight}
            onSelectHotel={onSelectHotel}
            onCheckHotelPrice={onCheckHotelPrice}
            onRefreshFlights={onRefreshFlights}
          />
        ))}
      </>
    );
  }

  const parsed = tryParseInlineSuggestions(message.text);
  if (parsed) {
    const braceIdx = message.text.indexOf("{");
    const preamble = braceIdx > 0 ? message.text.slice(0, braceIdx).trim() : undefined;
    return <InlineSuggestionsView parsed={parsed} preamble={preamble} onSelect={onSelectCard} />;
  }

  return <p className="whitespace-pre-wrap break-words text-slate-100">{message.text}</p>;
}

// ── Main component ───────────────────────────────────────────────────────────

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingBlock, setPendingBlock] = useState<string | null>(null);
  const [error, setError] = useState<ChatError | null>(null);
  const [activeMode, setActiveMode] = useState<ChatMode>(DEFAULT_CHAT_MODE);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [modeNote, setModeNote] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [showJump, setShowJump] = useState(false);
  const [selectedFlights, setSelectedFlights] = useState<Record<string, string>>({});
  const [selectedHotels, setSelectedHotels] = useState<Record<string, string>>({});
  const [checkingHotelId, setCheckingHotelId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const streamingMessageAddedRef = useRef(false);
  const stickToBottomRef = useRef(true);
  const hasMessages = messages.length > 0;

  // Restore mode, thread, and history on mount.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let savedThreadId: string | null = null;
      let savedModeId: string | null = null;
      try {
        const params = new URLSearchParams(window.location.search);
        savedThreadId = params.get("thread");
        savedModeId = window.localStorage.getItem("beetlebot.chat.mode");
        if (!savedThreadId) {
          savedThreadId = window.localStorage.getItem("beetlebot.chat.threadId");
        }
        const savedSent = window.localStorage.getItem("beetlebot.chat.sentCount");
        if (savedSent) setSentCount(Number(savedSent) || 0);
      } catch {
        // Ignore storage access issues.
      }
      if (savedModeId) {
        const found = CHAT_MODES.find((m) => m.id === savedModeId);
        if (found) setActiveMode(found);
      }
      if (savedThreadId && savedThreadId.length >= 8) {
        setThreadId(savedThreadId);
        try {
          const response = await fetch(`/api/chat?threadId=${encodeURIComponent(savedThreadId)}`);
          const payload = (await response.json()) as {
            data?: {
              messages?: Array<{
                id: string;
                role: string;
                text: string;
                blocks?: RichBlock[] | null;
              }>;
            };
          };
          if (!cancelled && response.ok && payload.data?.messages?.length) {
            const restored: ChatMessage[] = payload.data.messages.map((m) => ({
              id: m.id,
              role: m.role === "assistant" ? "assistant" : "user",
              text: m.text,
              blocks: m.blocks ?? undefined,
            }));
            // Rule chips rebuild from the last reply's blocks.
            const last = restored[restored.length - 1];
            if (last?.role === "assistant") {
              const chips = ruleFollowUps(last.blocks);
              if (chips.length > 0) last.followUps = chips;
            }
            setMessages(restored);
          }
        } catch {
          // History load failed: start empty, the thread still restores on send.
        }
      }
      if (!cancelled) setStorageHydrated(true);
    };
    void load();
    return () => {
      cancelled = true;
    };
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
        const url = new URL(window.location.href);
        url.searchParams.set("thread", threadId);
        window.history.replaceState(null, "", url.toString());
      } else {
        window.localStorage.removeItem("beetlebot.chat.threadId");
      }
      window.localStorage.setItem("beetlebot.chat.sentCount", String(sentCount));
    } catch {
      // Ignore localStorage access issues.
    }
  }, [threadId, sentCount, storageHydrated]);

  function scrollToBottom(smooth = true) {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickToBottomRef.current = nearBottom;
    setShowJump(streaming && !nearBottom);
  }

  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom();
  }, [messages, status, pendingBlock]);

  function updateStreamingMessage(patch: (m: ChatMessage) => ChatMessage) {
    const id = streamingIdRef.current;
    if (!id) return;
    if (!streamingMessageAddedRef.current) {
      streamingMessageAddedRef.current = true;
      setMessages((prev) => [...prev, { id, role: "assistant", text: "" }]);
    }
    setMessages((prev) => prev.map((m) => (m.id === id ? patch(m) : m)));
  }

  function handleCardSelect(card: ImageCard) {
    const msg = card.actionUrl
      ? `I'd like to go with "${card.title}". Here's the link: ${card.actionUrl}`
      : `I'd like to go with "${card.title}".`;
    void submitMessage(msg);
  }

  async function submitAction(
    userLine: string,
    action: Record<string, unknown>,
    apply: (payload: {
      reply: string;
      blocks?: RichBlock[];
      followUps?: FollowUp[];
      threadId?: string;
      messageId?: string;
      replaceBlockType?: string;
    }) => void,
  ) {
    setError(null);
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: "user", text: userLine, mode: activeMode.id },
    ]);
    setSentCount((n) => n + 1);
    setModeNote(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userLine,
          action,
          mode: activeMode.id,
          threadId: threadId ?? undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const payload = (await response.json()) as {
        data?: {
          reply?: string;
          blocks?: RichBlock[];
          followUps?: FollowUp[];
          threadId?: string;
          messageId?: string;
          replaceBlockType?: string;
        };
        error?: string;
      };
      const data = payload.data;
      if (!response.ok || !data?.reply) {
        throw new Error(payload.error ?? "Unable to process message.");
      }
      const reply = data.reply;
      if (data.threadId && data.threadId.length >= 8) setThreadId(data.threadId);
      apply({
        reply,
        blocks: data.blocks,
        followUps: data.followUps,
        threadId: data.threadId,
        messageId: data.messageId,
        replaceBlockType: data.replaceBlockType,
      });
    } catch {
      setError({
        code: "UNKNOWN",
        message: "Something went wrong on our side. Your message is saved.",
        retryable: true,
        requestId: "client",
      });
    } finally {
      setCheckingHotelId(undefined);
    }
  }

  async function submitMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || streaming) return;
    setStreaming(true);
    setError(null);
    setStatus("Reading your request");
    setPendingBlock(null);
    setModeNote(null);
    const userId = newId();
    const assistantId = newId();
    streamingIdRef.current = assistantId;
    streamingMessageAddedRef.current = false;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text: trimmed, mode: activeMode.id },
    ]);
    setInput("");
    setSentCount((n) => n + 1);

    const controller = new AbortController();
    abortRef.current = controller;
    let finished = false;

    await streamChatResponse(
      {
        message: trimmed,
        mode: activeMode.id,
        threadId: threadId ?? undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      {
        onStatus: (text) => setStatus(text),
        onTextDelta: (text) => {
          updateStreamingMessage((m) => ({
            ...m,
            text: m.text ? `${m.text} ${text}` : text,
          }));
        },
        onBlockPending: (_id, type) => setPendingBlock(type),
        onBlock: (_id, block) => {
          setPendingBlock(null);
          updateStreamingMessage((m) => ({
            ...m,
            blocks: [...(m.blocks ?? []), block],
          }));
        },
        onFollowUps: (items) => {
          updateStreamingMessage((m) => ({ ...m, followUps: items }));
        },
        onDone: (data) => {
          finished = true;
          if (data.threadId && data.threadId.length >= 8) setThreadId(data.threadId);
          updateStreamingMessage((m) => ({
            ...m,
            packsUsed: data.packsUsed,
          }));
          setStreaming(false);
          setStatus(null);
          setPendingBlock(null);
          streamingIdRef.current = null;
          setShowJump(false);
        },
        onError: (data) => {
          finished = true;
          setError(data);
          setStreaming(false);
          setStatus(null);
          setPendingBlock(null);
          streamingIdRef.current = null;
        },
      },
      controller.signal,
    );

    if (!finished && !controller.signal.aborted) {
      // Stream ended without an error or done event: close the state.
      setStreaming(false);
      setStatus(null);
      setPendingBlock(null);
      streamingIdRef.current = null;
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function stopStreaming() {
    abortRef.current?.abort();
    setStreaming(false);
    setStatus(null);
    setPendingBlock(null);
    setShowJump(false);
    if (streamingMessageAddedRef.current) {
      updateStreamingMessage((m) => ({ ...m, stopped: true }));
    }
    streamingIdRef.current = null;
  }

  function retryLast() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setError(null);
    void submitMessage(lastUser.text);
  }

  function handleSelectFlight(card: FlightCard, block: FlightCompareBlock) {
    setSelectedFlights((prev) => ({ ...prev, [block.searchId]: card.id }));
    void submitAction(
      `Picked ${card.airline}, ${formatMoney(card.totalAmount, card.currency)}.`,
      { type: "select_flight", offerId: card.offerId ?? card.id, searchId: block.searchId },
      (payload) => {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            text: payload.reply,
            blocks: payload.blocks,
            followUps: payload.followUps,
          },
        ]);
      },
    );
  }

  function handleSelectHotel(hotel: HotelCard) {
    setSelectedHotels((prev) => ({ ...prev, [hotel.id]: hotel.id }));
    void submitAction(`Add ${hotel.name}.`, { type: "select_hotel", hotelId: hotel.id }, (payload) => {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          text: payload.reply,
          blocks: payload.blocks,
          followUps: payload.followUps,
        },
      ]);
    });
  }

  function handleCheckHotelPrice(hotel: HotelCard) {
    setCheckingHotelId(hotel.id);
    void submitAction(
      `Check price for ${hotel.name}`,
      { type: "check_hotel_price", hotelId: hotel.id },
      (payload) => {
        if (payload.replaceBlockType && payload.blocks?.length) {
          const replacement = payload.blocks[0];
          setMessages((prev) =>
            prev.map((m) => {
              if (m.role !== "assistant" || !m.blocks) return m;
              if (!m.blocks.some((b) => b.type === payload.replaceBlockType)) return m;
              return {
                ...m,
                blocks: m.blocks.map((b) =>
                  b.type === payload.replaceBlockType ? replacement : b,
                ),
              };
            }),
          );
        }
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: "assistant", text: payload.reply },
        ]);
      },
    );
  }

  function handleRefreshFlights() {
    void submitMessage("Weekend in New York from Toronto, Fri to Mon, 1 adult");
  }

  function handleModeChange(mode: ChatMode) {
    setActiveMode(mode);
    if (mode.id !== "auto") setModeNote(`Mode: ${mode.label}`);
  }

  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  })();

  return (
    <div className="flex h-full flex-col">
      {/* Message area */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-6">
        {!hasMessages ? (
          <div className="flex h-full flex-col items-center justify-center gap-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/15 text-4xl shadow-lg shadow-amber-400/10">
                🪲
              </div>
              <h2 className="text-2xl font-semibold text-white">How can I help you today?</h2>
              <p className="mt-2 text-sm text-slate-400">
                Plans for your free time, from Friday night to weekend trips.
              </p>
            </div>
            <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => {
                    if (action.prompt) {
                      setInput(action.prompt);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    } else {
                      void submitMessage(action.title);
                    }
                  }}
                  className="group rounded-xl border border-white/8 bg-[#0d1422] p-4 text-left transition-all hover:border-amber-300/30 hover:bg-[#111d30]"
                >
                  <div className="mb-2 text-2xl">{action.icon}</div>
                  <p className="text-sm font-medium text-white">{action.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{action.subtitle}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {modeNote && (
              <p className="text-center text-xs text-slate-500">{modeNote}</p>
            )}
            {messages.map((message, idx) => (
              <div
                key={message.id}
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
                    <div className="rounded-2xl rounded-br-sm bg-amber-400/20 px-4 py-3 text-sm leading-relaxed text-amber-50">
                      {message.mode && message.mode !== "auto" && (
                        <p className="mb-1.5 text-xs text-amber-300/60">
                          {CHAT_MODES.find((m) => m.id === message.mode)?.icon}{" "}
                          {CHAT_MODES.find((m) => m.id === message.mode)?.label}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
                    </div>
                  ) : (
                    <div className="group/bubble overflow-hidden rounded-2xl rounded-bl-sm bg-[#131c2e] px-4 py-3 text-sm leading-relaxed">
                      {message.packsUsed && message.packsUsed.length > 0 && (
                        <p className="mb-2 text-[11px] font-medium text-slate-500">
                          Using{" "}
                          {message.packsUsed.map((s) => packSlugToFriendlyName(s)).join(", ")}{" "}
                          {message.packsUsed.length === 1 ? "pack" : "packs"}
                        </p>
                      )}
                      <AssistantMessageBody
                        message={message}
                        selectedFlight={(() => {
                          const block = message.blocks?.find(
                            (b) => b.type === "flight_compare",
                          ) as FlightCompareBlock | undefined;
                          return block ? selectedFlights[block.searchId] : undefined;
                        })()}
                        selectedHotel={(() => {
                          const block = message.blocks?.find(
                            (b) => b.type === "hotel_set",
                          ) as HotelSetBlock | undefined;
                          return block?.hotels.find((h) => selectedHotels[h.id])?.id;
                        })()}
                        checkingHotelId={checkingHotelId}
                        onSelectCard={handleCardSelect}
                        onSelectFlight={handleSelectFlight}
                        onSelectHotel={handleSelectHotel}
                        onCheckHotelPrice={handleCheckHotelPrice}
                        onRefreshFlights={handleRefreshFlights}
                      />
                      {message.stopped && (
                        <p className="mt-2 text-xs text-slate-500">
                          Stopped.{" "}
                          <button
                            type="button"
                            onClick={retryLast}
                            className="text-amber-300 underline-offset-2 hover:underline"
                          >
                            Retry
                          </button>
                        </p>
                      )}
                      {idx === lastAssistantIndex &&
                        message.followUps &&
                        message.followUps.length > 0 && (
                          <FollowUpChips
                            items={message.followUps}
                            disabled={streaming}
                            onSend={(chip) => void submitMessage(chip.message)}
                            onEdit={(chip) => {
                              setInput(chip.message);
                              setTimeout(() => inputRef.current?.focus(), 50);
                            }}
                          />
                        )}
                      <JsonInspector message={message} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {streaming && status && (
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-base">
                  🪲
                </div>
                <div className="min-w-0 flex-1">
                  <StatusLine text={status} />
                  {pendingBlock && <BlockSkeleton type={pendingBlock} />}
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-white/8 border-l-4 border-l-amber-400 bg-[#131c2e] px-4 py-3 text-sm text-slate-300">
                <p className="flex items-start gap-2">
                  <span>⚠️</span>
                  <span>{error.message}</span>
                </p>
                {error.fix && (
                  <p className="mt-1 pl-6 text-xs text-slate-500">{error.fix}</p>
                )}
                <div className="mt-3 flex items-center gap-2 pl-6">
                  {error.retryable && (
                    <button
                      type="button"
                      onClick={retryLast}
                      className="rounded-lg bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/25"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(
                        `${error.code} · req ${error.requestId}`,
                      );
                    }}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:border-white/20 hover:text-slate-200"
                  >
                    Copy details
                  </button>
                  <span className="text-[11px] text-slate-600">
                    {error.code} · req {error.requestId}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {showJump && (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="rounded-full border border-white/10 bg-[#0d1422] px-3 py-1.5 text-xs text-slate-300 shadow-lg hover:border-amber-300/30"
          >
            Jump to latest ↓
          </button>
        </div>
      )}

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => void submitMessage(input)}
        onStop={stopStreaming}
        streaming={streaming}
        mode={activeMode}
        onModeChange={handleModeChange}
        sentCount={sentCount}
        inputRef={inputRef}
      />
    </div>
  );
}
