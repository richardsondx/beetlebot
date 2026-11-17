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
import {
  applyPricePending,
  correctDestinationCountry,
  PRICE_PENDING_LABEL,
} from "@/lib/travel/destination-suggestion";
import { streamChatResponse } from "@/hooks/use-chat-stream";
import { CHAT_MODES, DEFAULT_CHAT_MODE, type ModeDefinition } from "@/lib/constants";
import { Composer } from "@/components/chat/composer";
import { Greeting } from "@/components/chat/greeting";
import { ThinkingDots, UserBubble } from "@/components/chat/message-bubble";
import { Logo } from "@/components/ui/logo";
import { FollowUpChips } from "@/components/chat/follow-up-chips";
import { StatusLine } from "@/components/chat/status-line";
import { BlockSkeleton } from "@/components/chat/block-skeleton";
import { FlightCompareView } from "@/components/chat/blocks/flight-compare";
import { HotelSetView } from "@/components/chat/blocks/hotel-set";
import { MapStripView } from "@/components/chat/blocks/map-strip";
import { NearbyRowView } from "@/components/chat/blocks/nearby-row";
import { ItineraryTimelineView } from "@/components/chat/blocks/itinerary-timeline";

type ChatMode = ModeDefinition;

// ── Suggestion chips (§4.1): a click fills and sends ─────────────────────────

/** Beach compare titles, kept in step with BEACH_COUNTRY in lib/travel/beach-compare.ts. */
const BEACH_TITLES = new Set(["Bali", "Maldives", "Palawan"]);

const SUGGESTION_CHIPS = [
  "Plan a rainy Saturday in Toronto",
  "Find a weekend escape under $400",
  "Compare flights to Montreal",
  "Book-free spa day ideas",
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

function categoryIcon(): string {
  return "";
}

// ── Image card ──────────────────────────────────────────────────────────────

function ImageCardView({
  card,
  index,
  category,
  compare,
  selected,
  onSelect,
}: {
  card: ImageCard;
  index?: number;
  category?: string;
  compare?: boolean;
  selected?: boolean;
  onSelect?: (card: ImageCard) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeImage, setActiveImage] = useState(card.imageUrl);
  const hasRealImage = card.imageUrl && !card.imageUrl.includes("placehold.co") && !imgFailed;
  // Gallery: the hero plus up to 4 extra real photos, at most 5 total.
  const galleryImages = hasRealImage
    ? [
        { imageUrl: card.imageUrl, sourceName: card.sourceName },
        ...(card.gallery ?? []).filter((g) => g.imageUrl !== card.imageUrl),
      ].slice(0, 5)
    : [];

  return (
    <div className="group overflow-hidden rounded-2xl border border-[#E7E5E0] bg-white transition-all duration-200 hover:border-[#E7E5E0] hover:shadow-xl hover:shadow-black/10">
      <button
        type="button"
        onClick={() => hasRealImage && setExpanded((v) => !v)}
        aria-label={hasRealImage ? `See ${card.title} photo larger` : card.title}
        className="relative block aspect-[5/3] w-full overflow-hidden bg-[#F2F1EE] text-left"
      >
        {index !== undefined && (
          <div className="absolute left-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white backdrop-blur-md ring-1 ring-[#E7E5E0]">
            {index}
          </div>
        )}
        {category && (
          <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-md ring-1 ring-[#E7E5E0]">
            <span className="text-xs">{categoryIcon()}</span>
            <span className="text-[10px] capitalize text-[#6B6862]">{category}</span>
          </div>
        )}
        {selected && (
          <div className="absolute left-2.5 top-10 z-10 rounded-full bg-[#C8811A] px-2 py-0.5 text-[10px] font-bold text-white">
            Selected
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
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2F1EE] text-3xl ring-1 ring-[#E7E5E0]">
              {categoryIcon()}
            </div>
            <span className="max-w-[80%] text-center text-xs text-[#6B6862] leading-snug">
              {card.title}
            </span>
          </div>
        )}
        {hasRealImage && (
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-transparent" />
        )}
      </button>
      {expanded && hasRealImage && (
        <div className="border-b border-[#E7E5E0]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeImage}
            alt={card.alt ?? card.title}
            className="h-auto w-full object-cover"
            loading="lazy"
          />
          {galleryImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-2">
              {galleryImages.map((g, gi) => (
                <button
                  key={`${g.imageUrl}-${gi}`}
                  type="button"
                  onClick={() => setActiveImage(g.imageUrl)}
                  aria-label={`Show photo ${gi + 1} of ${card.title}`}
                  className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 ${
                    activeImage === g.imageUrl ? "ring-[#C8811A]" : "ring-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.imageUrl}
                    alt={`${card.title} photo ${gi + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
          <p className="px-3 pb-2 text-[11px] text-[#9A968F]">
            {galleryImages.length > 1
              ? `Photo ${Math.max(1, galleryImages.findIndex((g) => g.imageUrl === activeImage) + 1)} of ${galleryImages.length}`
              : "Photo 1 of 1"}
            {activeImage !== card.imageUrl ||
            galleryImages.find((g) => g.imageUrl === activeImage)?.sourceName
              ? ` · Photo: ${galleryImages.find((g) => g.imageUrl === activeImage)?.sourceName ?? card.sourceName ?? ""}`
              : ""}
          </p>
        </div>
      )}
      <div className="p-3.5">
        <p className="text-sm font-semibold text-[#1C1B19] leading-snug">{card.title}</p>
        {card.subtitle && (
          <p className="mt-1 text-xs text-[#6B6862] leading-relaxed">{card.subtitle}</p>
        )}
        {card.pricePending && (
          <p className="mt-2 text-xs text-[#6B6862]">
            <span className="font-medium text-[#1C1B19]">Price</span>
            <span> · {PRICE_PENDING_LABEL}</span>
          </p>
        )}
        {card.compareRows && card.compareRows.length > 0 && (
          <dl className="mt-3 flex flex-col gap-1.5">
            {card.compareRows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3 text-[13px]">
                <dt className="shrink-0 text-[#6B6862]">{row.label}</dt>
                <dd className="text-right font-semibold text-[#1C1B19]">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {card.meta && Object.keys(card.meta).length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {Object.entries(card.meta).map(([, value]) => (
              <span
                key={value}
                className="rounded-full border border-[#E7E5E0] bg-[#F2F1EE] px-2.5 py-0.5 text-[11px] font-medium text-[#6B6862]"
              >
                {value}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onSelect && !compare && (
            <button
              type="button"
              onClick={() => onSelect(card)}
              className="rounded-lg bg-[#C8811A]/15 px-4 py-1.5 text-xs font-semibold text-[#8A5710] transition-all hover:bg-[#C8811A]/25 active:scale-[0.97]"
            >
              Choose this
            </button>
          )}
          {compare && onSelect && !selected && (
            <button
              type="button"
              onClick={() => onSelect(card)}
              className="w-full rounded-full bg-[#C8811A] px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#A96E15] active:scale-[0.98]"
            >
              Pick {card.title}
            </button>
          )}
          {compare && selected && (
            <span className="w-full rounded-full bg-[#C8811A]/15 px-4 py-2.5 text-center text-sm font-bold text-[#8A5710]">
              Selected
            </span>
          )}
          {card.actionUrl && (
            <a
              href={card.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] px-3 py-1.5 text-xs text-[#6B6862] transition-colors hover:border-[#E7E5E0] hover:text-[#1C1B19]"
            >
              View
              <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 10L10 2M6 2h4v4" />
              </svg>
            </a>
          )}
        </div>
        {card.sourceName && (
          <p className="mt-2.5 truncate text-[10px] text-[#9A968F]">via {card.sourceName}</p>
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
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-transparent" />
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
  const isCompare = optionSet.variant === "compare";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const handleCompareSelect = (card: ImageCard) => {
    setSelectedTitle(card.title);
    onSelect?.(card);
  };
  const onCompareScroll = () => {
    const el = scrollRef.current;
    if (!el || optionSet.items.length === 0) return;
    const idx = Math.round(el.scrollLeft / (el.scrollWidth / optionSet.items.length));
    setActiveDot(Math.max(0, Math.min(optionSet.items.length - 1, idx)));
  };
  if (isCompare) {
    const picked = selectedTitle
      ? optionSet.items.find((item) => item.card.title === selectedTitle)
      : undefined;
    if (picked) {
      return (
        <div className="mt-3">
          {optionSet.prompt && (
            <p className="mb-3 text-xs font-medium text-[#6B6862]">{optionSet.prompt}</p>
          )}
          <ImageCardView
            card={picked.card}
            index={picked.index}
            category={picked.card.category}
            compare
            selected
            onSelect={handleCompareSelect}
          />
          <p className="mt-3 text-xs text-[#6B6862]">
            Picked {picked.card.title}.{" "}
            <button
              type="button"
              onClick={() => setSelectedTitle(null)}
              className="font-semibold text-[#8A5710] underline-offset-2 hover:underline"
            >
              Change
            </button>
          </p>
        </div>
      );
    }
    return (
      <div className="mt-3">
        {optionSet.prompt && (
          <p className="mb-3 text-xs font-medium text-[#6B6862]">{optionSet.prompt}</p>
        )}
        <div
          ref={scrollRef}
          onScroll={onCompareScroll}
          className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {optionSet.items.map(({ index, card }) => (
            <div
              key={`${index}-${card.title}`}
              className="w-[86%] shrink-0 sm:w-auto"
              style={{ scrollSnapAlign: "start" }}
            >
              <ImageCardView
                card={card}
                index={index}
                category={card.category}
                compare
                onSelect={handleCompareSelect}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-center gap-1.5 sm:hidden" aria-label="Compare pages">
          {optionSet.items.map((item, i) => (
            <span
              key={item.index}
              className={`h-1.5 w-1.5 rounded-full ${i === activeDot ? "bg-[#C8811A]" : "bg-[#D8D5CF]"}`}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-[#6B6862]">
          Sample prices, not live. Beetlebot does not book. Reply 1, 2, or 3 to pick.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-3">
      {optionSet.prompt && (
        <p className="mb-3 text-xs font-medium text-[#6B6862]">{optionSet.prompt}</p>
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
            category={card.category}
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
        <p className="whitespace-pre-wrap break-words text-[#1C1B19]">{preamble}</p>
      )}
      <p className="whitespace-pre-wrap break-words text-[#1C1B19] mt-0">{parsed.text}</p>
      <div className="mt-3">
        <p className="mb-3 text-xs font-medium text-[#6B6862]">Here are your options — tap one to explore further:</p>
        <div className={`grid gap-3 ${parsed.options.length === 1 ? "grid-cols-1" : parsed.options.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
          {parsed.options.map((opt, i) => {
            const card: ImageCard = applyPricePending(
              correctDestinationCountry({
                type: "image_card",
                title: opt.title,
                subtitle: opt.subtitle,
                // No trusted photo here: empty URL, so the card shows the
                // named fallback icon. Never a placehold.co image.
                imageUrl: "",
                alt: opt.title,
                category: opt.category,
                meta: opt.meta,
                actionUrl: opt.actionUrl,
                sourceName: opt.sourceName,
              }),
            );
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
        <p className="mt-2 break-words text-sm leading-relaxed text-[#6B6862]">{block.text}</p>
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
    case "map_strip":
      return <MapStripView block={block} />;
    case "nearby_row":
      return <NearbyRowView block={block} />;
    case "itinerary_timeline":
      return <ItineraryTimelineView block={block} />;
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
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono text-[#9A968F] opacity-0 transition-all hover:bg-[#F2F1EE] hover:text-[#6B6862] group-hover/bubble:opacity-100"
      >
        <span>{open ? "▾" : "▸"}</span>
        <span>{"{}"}</span>
      </button>
      {open && (
        <div className="mt-1.5 overflow-x-auto rounded-xl border border-[#E7E5E0] bg-white p-3">
          <pre className="whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-[#6B6862]">
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
          <p className="whitespace-pre-wrap break-words text-[#1C1B19]">{message.text}</p>
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

  return <p className="whitespace-pre-wrap break-words text-[#1C1B19]">{message.text}</p>;
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
    // A beach compare pick carries the choice into the trip plan.
    // Local set, kept in step with BEACH_COUNTRY in
    // lib/travel/beach-compare.ts: importing that module here would pull
    // the server-only photo resolver (node:fs) into the client bundle.
    if (BEACH_TITLES.has(card.title)) {
      handleSelectDestination(card.title);
      return;
    }
    const msg = card.actionUrl
      ? `I'd like to go with "${card.title}". Here's the link: ${card.actionUrl}`
      : `I'd like to go with "${card.title}".`;
    void submitMessage(msg);
  }

  function handleSelectDestination(destination: string) {
    void submitAction(
      `Picked ${destination}.`,
      { type: "select_destination", destination },
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
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center px-4">
            <Greeting />
            <div className="mt-12 w-full">
              <Composer
                value={input}
                onChange={setInput}
                onSend={() => void submitMessage(input)}
                onStop={stopStreaming}
                streaming={streaming}
                sentCount={sentCount}
                inputRef={inputRef}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Suggestions">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void submitMessage(chip)}
                  className="rounded-full bg-[#F2F1EE] px-3.5 py-2 text-sm font-medium text-[#1C1B19] transition-colors hover:bg-[#E7E5E0]"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[720px] flex-col gap-6">
            {modeNote && (
              <p className="text-center text-xs text-[#6B6862]">{modeNote}</p>
            )}
            {messages.map((message, idx) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FBF1E1] text-[#C8811A]">
                    <Logo size={24} />
                  </div>
                )}
                <div
                  className={`min-w-0 ${
                    message.role === "user" ? "max-w-[75%]" : "flex-1"
                  }`}
                >
                  {message.role === "user" ? (
                    <UserBubble>
                      {message.mode && message.mode !== "auto" && (
                        <p className="mb-1.5 text-xs text-[#6B6862]">
                          {CHAT_MODES.find((m) => m.id === message.mode)?.label}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
                    </UserBubble>
                  ) : (
                    <div className="group/bubble text-[15px] leading-[22px] text-[#1C1B19]">
                      {message.packsUsed && message.packsUsed.length > 0 && (
                        <p className="mb-2 text-[11px] font-medium text-[#9A968F]">
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
                        <p className="mt-2 text-xs text-[#6B6862]">
                          Stopped.{" "}
                          <button
                            type="button"
                            onClick={retryLast}
                            className="text-[#8A5710] underline-offset-2 hover:underline"
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
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FBF1E1] text-[#C8811A]">
                  <Logo size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <StatusLine text={status} />
                  <ThinkingDots />
                  {pendingBlock && <BlockSkeleton type={pendingBlock} />}
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-3 text-sm text-[#C23B32]" role="alert">
                <span>Something went wrong. Try again.</span>
                {error.retryable && (
                  <button
                    type="button"
                    onClick={retryLast}
                    className="font-semibold text-[#8A5710] underline-offset-2 hover:underline"
                  >
                    Retry
                  </button>
                )}
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
            className="rounded-full border border-[#E7E5E0] bg-white px-3 py-1.5 text-xs text-[#6B6862] shadow-md hover:border-[#D6D3CC]"
          >
            Jump to latest ↓
          </button>
        </div>
      )}

      {hasMessages && (
        <Composer
          value={input}
          onChange={setInput}
          onSend={() => void submitMessage(input)}
          onStop={stopStreaming}
          streaming={streaming}
          sentCount={sentCount}
          inputRef={inputRef}
        />
      )}
    </div>
  );
}
