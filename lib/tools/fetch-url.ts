import * as cheerio from "cheerio";
import type { ChatToolDefinition } from "@/lib/tools/types";
import {
  extractImageCandidatesFromHtml,
  extractPageMetadataFromHtml,
  isSafeRemoteUrl,
} from "@/lib/media/cache";

const MAX_CONTENT_LENGTH = 4000;
const FETCH_TIMEOUT_MS = 10_000;

const REMOVE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "nav",
  "footer",
  "header",
  "aside",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  ".cookie-banner",
  ".ad",
  ".ads",
  ".advertisement",
];

function resolveLink(href: string, baseUrl: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#")) return null;
  if (/^(mailto:|tel:|javascript:)/i.test(trimmed)) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractLinks($: cheerio.CheerioAPI, baseUrl: string) {
  const out: Array<{ href: string; text: string }> = [];
  const seen = new Set<string>();

  const anchors = $("main a[href], article a[href], [role='main'] a[href], body a[href]")
    .toArray()
    .slice(0, 200);
  for (const el of anchors) {
    const hrefRaw = $(el).attr("href");
    if (!hrefRaw) continue;
    const href = resolveLink(hrefRaw, baseUrl);
    if (!href) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    const text = ($(el).text() || "").replace(/\s+/g, " ").trim().slice(0, 90);
    out.push({ href, text });
    if (out.length >= 12) break;
  }

  return out;
}

function extractMainText(
  html: string,
  baseUrl: string,
  hint?: string,
): { title: string; text: string; links: Array<{ href: string; text: string }> } {
  const $ = cheerio.load(html);

  for (const selector of REMOVE_SELECTORS) {
    $(selector).remove();
  }

  const title = $("title").first().text().trim() || $("h1").first().text().trim() || "";

  const mainEl = $("main, [role='main'], article, .content, #content").first();
  const root = mainEl.length ? mainEl : $("body");
  const links = extractLinks($, baseUrl);

  const rawText = root
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (rawText.length <= MAX_CONTENT_LENGTH) {
    return { title, text: rawText, links };
  }

  if (hint) {
    const lower = rawText.toLowerCase();
    const hintLower = hint.toLowerCase();
    const idx = lower.indexOf(hintLower);
    if (idx !== -1) {
      const start = Math.max(0, idx - 500);
      const end = Math.min(rawText.length, idx + MAX_CONTENT_LENGTH - 500);
      return { title, text: rawText.slice(start, end), links };
    }
  }

  return { title, text: rawText.slice(0, MAX_CONTENT_LENGTH), links };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "beetlebot/1.0 (life-companion agent)",
        Accept: "text/html, application/xhtml+xml, */*",
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

export const fetchUrlTool: ChatToolDefinition = {
  name: "fetch_url",
  description:
    "Fetch and extract the main text content from a web page URL. Use this when you need live, up-to-date information from a website — event listings, articles, schedules, prices, etc. Returns the page title and extracted text.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The full URL to fetch (must start with http:// or https://).",
      },
      hint: {
        type: "string",
        description:
          "Optional: what you're looking for on the page. Helps focus extraction on the relevant section.",
      },
    },
    required: ["url"],
    additionalProperties: false,
  },
  async execute(args) {
    const url = typeof args.url === "string" ? args.url.trim() : "";
    const hint = typeof args.hint === "string" ? args.hint.trim() : undefined;

    if (!url || !/^https?:\/\//i.test(url)) {
      return { error: "Invalid URL. Must start with http:// or https://." };
    }

    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        return {
          error: `HTTP ${response.status} ${response.statusText}`,
          url,
        };
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        const text = await response.text();
        return {
          url,
          title: "",
          content: text.slice(0, MAX_CONTENT_LENGTH),
          contentType,
          truncated: text.length > MAX_CONTENT_LENGTH,
        };
      }

      const html = await response.text();
      const { title, text, links } = extractMainText(html, url, hint);
      const metadata = extractPageMetadataFromHtml(html);
      const imageCandidates = extractImageCandidatesFromHtml(html);
      const rankedCandidates = [
        ...imageCandidates.og,
        ...imageCandidates.twitter,
        ...imageCandidates.jsonLd,
        ...imageCandidates.imgTags,
      ]
        .map((candidate) => {
          try {
            return new URL(candidate, url).toString();
          } catch {
            return null;
          }
        })
        .filter((candidate): candidate is string => !!candidate && isSafeRemoteUrl(candidate, true));

      return {
        url,
        title,
        content: text,
        links,
        metadata,
        imageUrl: rankedCandidates[0] ?? null,
        imageCandidates: rankedCandidates.slice(0, 8),
        truncated: text.length >= MAX_CONTENT_LENGTH,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fetch failed";
      return { error: message, url };
    }
  },
};
