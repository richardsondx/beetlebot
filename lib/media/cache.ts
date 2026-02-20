import * as cheerio from "cheerio";
import crypto from "node:crypto";
import * as fs from "node:fs/promises";
import path from "node:path";

const PAGE_FETCH_TIMEOUT_MS = 10_000;
const IMAGE_FETCH_TIMEOUT_MS = 12_000;
const MAX_IMAGE_BYTES = Number(process.env.MEDIA_MAX_BYTES ?? 6_000_000);
const CACHE_DIR =
  process.env.MEDIA_CACHE_DIR ??
  path.join(process.cwd(), "data", "media");

const PRIVATE_HOST_PATTERNS = [
  /localhost/i,
  /\.local$/i,
  /127\.\d+\.\d+\.\d+/,
  /0\.0\.0\.0/,
  /::1/,
  /192\.168\.\d+\.\d+/,
  /10\.\d+\.\d+\.\d+/,
  /172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+/,
];

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

function isIpv4Literal(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function isPrivateIpv4(hostname: string): boolean {
  if (!isIpv4Literal(hostname)) return false;
  const parts = hostname.split(".").map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function isSafeRemoteUrl(url: string, allowHttp = true): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const protocolOk =
    parsed.protocol === "https:" || (allowHttp && parsed.protocol === "http:");
  if (!protocolOk) return false;
  if (parsed.username || parsed.password) return false;
  const host = parsed.hostname;
  if (!host) return false;
  if (isPrivateIpv4(host)) return false;
  // Block IPv6 literals (no DNS resolution here; safer default).
  if (host.includes(":")) return false;
  for (const pattern of PRIVATE_HOST_PATTERNS) {
    if (pattern.test(host)) return false;
  }
  return true;
}

function resolveUrl(candidate: string, baseUrl: string): string | null {
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function firstMetaContent($: cheerio.CheerioAPI, selectors: string[]): string | null {
  for (const selector of selectors) {
    const value = $(selector).attr("content")?.trim();
    if (value) return value;
  }
  return null;
}

function normalizeJsonLd(input: unknown): unknown[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return [input];
}

function collectJsonLdEventImages(node: unknown, out: string[]) {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;

  const typeValue = obj["@type"];
  const types = Array.isArray(typeValue)
    ? typeValue.filter((t) => typeof t === "string")
    : typeof typeValue === "string"
      ? [typeValue]
      : [];
  const isEvent = types.some((t) => t.toLowerCase() === "event");

  if (isEvent && obj.image) {
    const images = Array.isArray(obj.image) ? obj.image : [obj.image];
    for (const img of images) {
      if (typeof img === "string") out.push(img);
      else if (img && typeof img === "object") {
        const url = (img as Record<string, unknown>).url;
        if (typeof url === "string") out.push(url);
      }
    }
  }

  // Traverse common graph shapes
  const graph = obj["@graph"];
  if (graph) {
    for (const item of normalizeJsonLd(graph)) {
      collectJsonLdEventImages(item, out);
    }
  }

  // Traverse nested objects/arrays (bounded)
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 30)) collectJsonLdEventImages(item, out);
    } else if (value && typeof value === "object") {
      collectJsonLdEventImages(value, out);
    }
  }
}

export function extractEventImageCandidatesFromHtml(html: string): {
  og: string[];
  twitter: string[];
  jsonLd: string[];
  imgTags: string[];
} {
  const $ = cheerio.load(html);

  const ogCandidates: string[] = [];
  const twitterCandidates: string[] = [];
  const jsonLdCandidates: string[] = [];
  const imgTagCandidates: string[] = [];

  // OG / Twitter tags (collect all, caller ranks)
  $("meta[property^='og:image']").each((_, el) => {
    const content = $(el).attr("content")?.trim();
    if (content) ogCandidates.push(content);
  });
  $("meta[name='twitter:image'], meta[name='twitter:image:src']").each((_, el) => {
    const content = $(el).attr("content")?.trim();
    if (content) twitterCandidates.push(content);
  });

  // JSON-LD (Event.image)
  $("script[type='application/ld+json']").each((_, el) => {
    const raw = $(el).text();
    if (!raw?.trim()) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      const items = normalizeJsonLd(parsed);
      for (const item of items) collectJsonLdEventImages(item, jsonLdCandidates);
    } catch {
      // ignore
    }
  });

  // Fallback: likely-hero <img> tags
  const candidates = $("main img[src], article img[src], body img[src]").toArray().slice(0, 40);
  for (const el of candidates) {
    const src = $(el).attr("src")?.trim();
    if (!src) continue;
    if (src.startsWith("data:")) continue;
    if (src.endsWith(".svg") || src.includes(".svg?")) continue;
    imgTagCandidates.push(src);
  }

  return { og: ogCandidates, twitter: twitterCandidates, jsonLd: jsonLdCandidates, imgTags: imgTagCandidates };
}

async function fetchHtml(url: string): Promise<string | null> {
  if (!isSafeRemoteUrl(url, true)) return null;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "beetlebot/1.0 (image-enricher)",
        Accept: "text/html, application/xhtml+xml, */*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }
    return await res.text();
  } catch {
    return null;
  }
}

export async function discoverEventImageUrlFromPage(pageUrl: string): Promise<string | null> {
  const html = await fetchHtml(pageUrl);
  if (!html) return null;

  const candidates = extractEventImageCandidatesFromHtml(html);
  const ranked = [
    ...candidates.og,
    ...candidates.twitter,
    ...candidates.jsonLd,
    ...candidates.imgTags,
  ];

  for (const candidate of ranked) {
    const resolved = resolveUrl(candidate, pageUrl);
    if (!resolved) continue;
    if (!isSafeRemoteUrl(resolved, true)) continue;
    // For downstream channel sends, image URLs must be https; but allow http here
    // because we may cache/proxy it to our own https domain.
    return resolved;
  }

  return null;
}

async function readBytesWithLimit(
  res: Response,
  limitBytes: number,
): Promise<Uint8Array | null> {
  const len = Number(res.headers.get("content-length") ?? NaN);
  if (Number.isFinite(len) && len > limitBytes) return null;
  const reader = res.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.length;
      if (total > limitBytes) {
        try { await reader.cancel(); } catch { /* ignore */ }
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function extFromContentType(contentType: string, fallbackUrl?: string): string {
  const ct = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  const fromCt = CONTENT_TYPE_TO_EXT[ct];
  if (fromCt) return fromCt;
  if (fallbackUrl) {
    try {
      const u = new URL(fallbackUrl);
      const ext = path.extname(u.pathname).replace(".", "").toLowerCase();
      if (ext && EXT_TO_CONTENT_TYPE[ext]) return ext;
    } catch {
      // ignore
    }
  }
  return "jpg";
}

export async function cacheRemoteImageToDisk(imageUrl: string): Promise<string | null> {
  if (!isSafeRemoteUrl(imageUrl, true)) return null;
  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent": "beetlebot/1.0 (image-cache)",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("image/")) return null;

    const bytes = await readBytesWithLimit(res, MAX_IMAGE_BYTES);
    if (!bytes || bytes.length === 0) return null;

    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    const ext = extFromContentType(contentType, imageUrl);
    const id = `${hash}.${ext}`;
    const filePath = resolveCachedFilePath(id);
    if (!filePath) return null;

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
      await fs.stat(filePath);
      return id;
    } catch {
      await fs.writeFile(filePath, Buffer.from(bytes));
      return id;
    }
  } catch {
    return null;
  }
}

export function getPublicBaseUrl(): string | null {
  const envBase =
    process.env.BEETLEBOT_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (!envBase.startsWith("https://")) return null;
  return envBase.replace(/\/+$/, "");
}

export function publicMediaUrlForId(id: string): string | null {
  const base = getPublicBaseUrl();
  if (!base) return null;
  return `${base}/media/${encodeURIComponent(id)}`;
}

export async function getBestEventImageUrl(input: {
  actionUrl: string;
}): Promise<{ imageUrl: string; cached: boolean } | null> {
  const discovered = await discoverEventImageUrlFromPage(input.actionUrl);
  if (!discovered) return null;

  const publicBase = getPublicBaseUrl();
  if (!publicBase) {
    return { imageUrl: discovered, cached: false };
  }

  const cachedId = await cacheRemoteImageToDisk(discovered);
  if (!cachedId) {
    return { imageUrl: discovered, cached: false };
  }

  const url = publicMediaUrlForId(cachedId);
  if (!url) return { imageUrl: discovered, cached: false };
  return { imageUrl: url, cached: true };
}

export function resolveCachedFilePath(id: string): string | null {
  const trimmed = id.trim();
  // Prevent path traversal and unbounded filenames.
  if (!/^[a-f0-9]{64}\.[a-z0-9]{2,5}$/i.test(trimmed)) return null;
  const safeName = trimmed.toLowerCase();
  return path.join(CACHE_DIR, safeName);
}

export async function readCachedMedia(id: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const filePath = resolveCachedFilePath(id);
  if (!filePath) return null;
  try {
    const bytes = await fs.readFile(filePath);
    const ext = path.extname(filePath).replace(".", "").toLowerCase();
    const contentType = EXT_TO_CONTENT_TYPE[ext] ?? "application/octet-stream";
    return { bytes, contentType };
  } catch {
    return null;
  }
}
