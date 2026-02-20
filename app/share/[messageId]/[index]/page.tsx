import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareRedirect } from "@/components/share-redirect";
import { sanitiseBlocks } from "@/lib/chat/safety";
import type { ImageCard, RichBlock } from "@/lib/chat/rich-message";
import { db } from "@/lib/db";

type Params = { params: Promise<{ messageId: string; index: string }> };

function parseBlocks(blocksJson: string | null | undefined): RichBlock[] {
  if (!blocksJson) return [];
  try {
    const raw = JSON.parse(blocksJson) as unknown[];
    if (!Array.isArray(raw)) return [];
    return sanitiseBlocks(raw);
  } catch {
    return [];
  }
}

function flattenCards(blocks: RichBlock[]): ImageCard[] {
  const cards: ImageCard[] = [];
  for (const block of blocks) {
    if (block.type === "image_card") cards.push(block);
    else if (block.type === "image_gallery") cards.push(...block.items);
    else if (block.type === "option_set") cards.push(...block.items.map((i) => i.card));
  }
  return cards;
}

function getAnyBaseUrl(): string | null {
  const envBase =
    process.env.BEETLEBOT_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (!envBase) return null;
  try {
    return new URL(envBase).toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function toAbsoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = getAnyBaseUrl();
  if (!base) return url;
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

async function loadShareTarget(input: {
  messageId: string;
  index: number;
}): Promise<{ card: ImageCard; targetUrl: string } | null> {
  const msg = await db.conversationMessage.findUnique({
    where: { id: input.messageId },
  });
  const blocks = parseBlocks(msg?.blocksJson);
  const cards = flattenCards(blocks);
  if (!cards.length) return null;
  const idx = Math.max(1, Math.min(input.index, cards.length));
  const card = cards[idx - 1];
  const targetUrl = card.actionUrl || "";
  if (!targetUrl) return null;
  return { card, targetUrl };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { messageId, index } = await params;
  const parsedIndex = Number.parseInt(index, 10);
  const resolved = await loadShareTarget({
    messageId,
    index: Number.isFinite(parsedIndex) ? parsedIndex : 1,
  });

  const base = getAnyBaseUrl();
  const metadataBase = base ? new URL(base) : undefined;

  if (!resolved) {
    return {
      metadataBase,
      title: "BOXY",
      description: "Open shared recommendation.",
      openGraph: {
        title: "BOXY",
        description: "Open shared recommendation.",
      },
    };
  }

  const title = resolved.card.title || "BOXY";
  const description =
    resolved.card.subtitle?.trim() ||
    "Open shared recommendation.";
  const imageUrl = resolved.card.imageUrl ? toAbsoluteUrl(resolved.card.imageUrl) : undefined;

  return {
    metadataBase,
    title,
    description,
    openGraph: {
      title,
      description,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function SharePage({ params }: Params) {
  const { messageId, index } = await params;
  const parsedIndex = Number.parseInt(index, 10);

  const resolved = await loadShareTarget({
    messageId,
    index: Number.isFinite(parsedIndex) ? parsedIndex : 1,
  });
  if (!resolved) notFound();

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col justify-center px-6 py-14">
      <h1 className="text-balance text-2xl font-semibold text-slate-100">
        {resolved.card.title}
      </h1>
      {resolved.card.subtitle && (
        <p className="mt-2 text-sm text-slate-400">{resolved.card.subtitle}</p>
      )}

      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-slate-500">
          Redirecting you to the organizer…
        </p>
        <a
          className="mt-2 inline-flex text-sm font-medium text-teal-200 hover:text-teal-100"
          href={resolved.targetUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open event →
        </a>
      </div>

      <ShareRedirect to={resolved.targetUrl} />
    </main>
  );
}

