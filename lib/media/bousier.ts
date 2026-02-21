import {
  cacheRemoteImageToDisk,
  discoverImageCandidatesFromPage,
  getPublicBaseUrl,
  isSafeRemoteUrl,
  publicMediaUrlForId,
} from "@/lib/media/cache";

export type BousierTier = "tier1_metadata" | "tier2_open_data" | "tier3_dynamic" | "tier4_serp";

export type BousierCandidate = {
  imageUrl: string;
  sourceTier: BousierTier;
  sourceName: string;
  confidence: number;
  attribution?: string;
  license?: string;
};

export type BousierEntityInput = {
  title: string;
  category?: string;
  actionUrl?: string;
  query?: string;
};

export type BousierResolveOptions = {
  timeoutMs?: number;
  mode?: "safe" | "balanced" | "extended";
  enableTier3?: boolean;
  enableTier4?: boolean;
};

export type BousierResolvedImage = {
  selectedImageUrl: string | null;
  selectedSourceTier?: BousierTier;
  selectedSourceName?: string;
  selectedAttribution?: string;
  selectedLicense?: string;
  selectedConfidence?: number;
  cached: boolean;
  imageCandidates: BousierCandidate[];
  imageLastCheckedAt: string;
};

const DEFAULT_TIMEOUT_MS = Number(process.env.BOUSIER_TIMEOUT_MS ?? 1500);
const DEFAULT_MODE = (process.env.BOUSIER_MODE ?? "balanced").toLowerCase();
const TIER3_FLAG = process.env.BOUSIER_ENABLE_TIER3 === "true";
const TIER4_FLAG = process.env.BOUSIER_ENABLE_TIER4 === "true";
const ENABLE_CIRCUIT_BREAKER = process.env.BOUSIER_ENABLE_CIRCUIT_BREAKER !== "false";
const MAX_FAILURES_PER_HOST = Number(process.env.BOUSIER_MAX_FAILURES_PER_HOST ?? 3);
const HOST_COOLDOWN_MS = Number(process.env.BOUSIER_HOST_COOLDOWN_MS ?? 120_000);
const PREFER_PROXY_MEDIA = process.env.BOUSIER_PREFER_PROXY_MEDIA === "true";

type HostFailure = { count: number; cooldownUntil: number };
const hostFailures = new Map<string, HostFailure>();

type TierTelemetry = {
  attempts: number;
  hits: number;
  latencyMsTotal: number;
};

const telemetry: Record<BousierTier, TierTelemetry> = {
  tier1_metadata: { attempts: 0, hits: 0, latencyMsTotal: 0 },
  tier2_open_data: { attempts: 0, hits: 0, latencyMsTotal: 0 },
  tier3_dynamic: { attempts: 0, hits: 0, latencyMsTotal: 0 },
  tier4_serp: { attempts: 0, hits: 0, latencyMsTotal: 0 },
};
let telemetryCacheHits = 0;
let telemetryCacheMisses = 0;
let telemetryFallbackCount = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(null))
      .finally(() => clearTimeout(timer));
  });
}

function parseHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function canProbeHost(url: string): boolean {
  if (!ENABLE_CIRCUIT_BREAKER) return true;
  const host = parseHostname(url);
  if (!host) return false;
  const state = hostFailures.get(host);
  if (!state) return true;
  if (Date.now() >= state.cooldownUntil) {
    hostFailures.delete(host);
    return true;
  }
  return false;
}

function markHostSuccess(url: string): void {
  if (!ENABLE_CIRCUIT_BREAKER) return;
  const host = parseHostname(url);
  if (!host) return;
  hostFailures.delete(host);
}

function markHostFailure(url: string): void {
  if (!ENABLE_CIRCUIT_BREAKER) return;
  const host = parseHostname(url);
  if (!host) return;
  const prev = hostFailures.get(host);
  const count = (prev?.count ?? 0) + 1;
  if (count >= MAX_FAILURES_PER_HOST) {
    hostFailures.set(host, { count, cooldownUntil: Date.now() + HOST_COOLDOWN_MS });
    return;
  }
  hostFailures.set(host, { count, cooldownUntil: 0 });
}

function scoreCandidate(candidate: BousierCandidate): number {
  let score = candidate.confidence;
  if (candidate.imageUrl.includes("/media/")) score += 0.1;
  if (candidate.imageUrl.startsWith("https://")) score += 0.1;
  if (candidate.imageUrl.includes("wikimedia.org")) score += 0.1;
  if (candidate.imageUrl.includes("wikipedia.org")) score += 0.08;
  return Math.max(0, Math.min(1, score));
}

function dedupeCandidates(candidates: BousierCandidate[]): BousierCandidate[] {
  const byUrl = new Map<string, BousierCandidate>();
  for (const candidate of candidates) {
    if (!isSafeRemoteUrl(candidate.imageUrl, true)) continue;
    const existing = byUrl.get(candidate.imageUrl);
    if (!existing || scoreCandidate(candidate) > scoreCandidate(existing)) {
      byUrl.set(candidate.imageUrl, candidate);
    }
  }
  return Array.from(byUrl.values()).sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
}

async function tier1FromCanonicalPage(input: BousierEntityInput): Promise<BousierCandidate[]> {
  if (!input.actionUrl || !canProbeHost(input.actionUrl)) return [];
  const started = Date.now();
  telemetry.tier1_metadata.attempts += 1;
  const candidates = await discoverImageCandidatesFromPage(input.actionUrl);
  telemetry.tier1_metadata.latencyMsTotal += Date.now() - started;
  if (!candidates.length) {
    markHostFailure(input.actionUrl);
    return [];
  }
  telemetry.tier1_metadata.hits += 1;
  markHostSuccess(input.actionUrl);
  return candidates.map((url, idx) => ({
    imageUrl: url,
    sourceTier: "tier1_metadata" as const,
    sourceName: "canonical_metadata",
    confidence: Math.max(0.45, 0.9 - idx * 0.08),
  }));
}

async function tier2FromWikipedia(input: BousierEntityInput): Promise<BousierCandidate[]> {
  const title = input.title.trim();
  if (!title) return [];
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  if (!canProbeHost(summaryUrl)) return [];
  const started = Date.now();
  telemetry.tier2_open_data.attempts += 1;
  try {
    const res = await fetch(summaryUrl, {
      headers: {
        "User-Agent": "beetlebot/1.0 (bousier-tier2)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(1200),
    });
    if (!res.ok) {
      telemetry.tier2_open_data.latencyMsTotal += Date.now() - started;
      markHostFailure(summaryUrl);
      return [];
    }
    const data = (await res.json()) as {
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };
    const out: BousierCandidate[] = [];
    if (typeof data.originalimage?.source === "string") {
      out.push({
        imageUrl: data.originalimage.source,
        sourceTier: "tier2_open_data",
        sourceName: "wikipedia_summary",
        confidence: 0.62,
        attribution: data.content_urls?.desktop?.page,
      });
    }
    if (typeof data.thumbnail?.source === "string") {
      out.push({
        imageUrl: data.thumbnail.source,
        sourceTier: "tier2_open_data",
        sourceName: "wikipedia_summary",
        confidence: 0.55,
        attribution: data.content_urls?.desktop?.page,
      });
    }
    if (out.length > 0) markHostSuccess(summaryUrl);
    if (out.length > 0) telemetry.tier2_open_data.hits += 1;
    telemetry.tier2_open_data.latencyMsTotal += Date.now() - started;
    return out;
  } catch {
    telemetry.tier2_open_data.latencyMsTotal += Date.now() - started;
    markHostFailure(summaryUrl);
    return [];
  }
}

function tier3DynamicFallbackEnabled(options: BousierResolveOptions): boolean {
  if (options.enableTier3 != null) return options.enableTier3;
  return TIER3_FLAG;
}

function tier4SerpFallbackEnabled(options: BousierResolveOptions): boolean {
  if (options.enableTier4 != null) return options.enableTier4;
  return TIER4_FLAG;
}

function modeOf(options: BousierResolveOptions): "safe" | "balanced" | "extended" {
  const mode = (options.mode ?? DEFAULT_MODE) as "safe" | "balanced" | "extended";
  if (mode === "safe" || mode === "balanced" || mode === "extended") return mode;
  return "balanced";
}

async function maybeCache(candidate: BousierCandidate): Promise<{ url: string; cached: boolean }> {
  const publicBase = getPublicBaseUrl();
  if (!publicBase) return { url: candidate.imageUrl, cached: false };
  const cachedId = await cacheRemoteImageToDisk(candidate.imageUrl);
  if (!cachedId) {
    telemetryCacheMisses += 1;
    return { url: candidate.imageUrl, cached: false };
  }
  const publicUrl = publicMediaUrlForId(cachedId);
  if (!publicUrl) {
    telemetryCacheMisses += 1;
    return { url: candidate.imageUrl, cached: false };
  }
  telemetryCacheHits += 1;
  // In local development, stale tunnel/public base URLs can break rendering.
  // Prefer direct source URLs unless explicitly forcing proxy-media URLs.
  if (!PREFER_PROXY_MEDIA) {
    return { url: candidate.imageUrl, cached: true };
  }
  return { url: publicUrl, cached: true };
}

export async function resolveImageForEntity(
  input: BousierEntityInput,
  options: BousierResolveOptions = {},
): Promise<BousierResolvedImage> {
  const timeoutMs = Math.max(400, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const mode = modeOf(options);
  const startedAt = nowIso();
  const candidates: BousierCandidate[] = [];

  const tier1 = await withTimeout(tier1FromCanonicalPage(input), Math.min(1200, timeoutMs));
  if (tier1?.length) candidates.push(...tier1);

  const shouldRunTier2 = !tier1?.length || mode !== "safe";
  if (shouldRunTier2) {
    const tier2 = await withTimeout(tier2FromWikipedia(input), Math.min(900, timeoutMs));
    if (tier2?.length) candidates.push(...tier2);
  }

  // Reserved extension points; disabled by default and intentionally conservative.
  const enableTier3 = tier3DynamicFallbackEnabled(options) && mode !== "safe";
  const enableTier4 = tier4SerpFallbackEnabled(options) && mode === "extended";
  if (enableTier3 || enableTier4) {
    // TODO: connectors can be implemented behind explicit flags.
  }

  const ranked = dedupeCandidates(candidates);
  const selected = ranked[0];
  if (!selected) {
    telemetryFallbackCount += 1;
    return {
      selectedImageUrl: null,
      cached: false,
      imageCandidates: [],
      imageLastCheckedAt: startedAt,
    };
  }
  const cached = await maybeCache(selected);
  return {
    selectedImageUrl: cached.url,
    selectedSourceTier: selected.sourceTier,
    selectedSourceName: selected.sourceName,
    selectedAttribution: selected.attribution,
    selectedLicense: selected.license,
    selectedConfidence: scoreCandidate(selected),
    cached: cached.cached,
    imageCandidates: ranked,
    imageLastCheckedAt: startedAt,
  };
}

export async function resolveImageBatch(
  inputs: BousierEntityInput[],
  options: BousierResolveOptions = {},
): Promise<BousierResolvedImage[]> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const perItem = Math.max(450, Math.min(timeoutMs, 2200));
  return Promise.all(inputs.map((input) => resolveImageForEntity(input, { ...options, timeoutMs: perItem })));
}

export function getBousierTelemetry() {
  const avgLatency = (tier: TierTelemetry) =>
    tier.attempts > 0 ? Math.round(tier.latencyMsTotal / tier.attempts) : 0;
  const cacheTotal = telemetryCacheHits + telemetryCacheMisses;
  return {
    tiers: {
      tier1_metadata: {
        attempts: telemetry.tier1_metadata.attempts,
        hits: telemetry.tier1_metadata.hits,
        avgLatencyMs: avgLatency(telemetry.tier1_metadata),
      },
      tier2_open_data: {
        attempts: telemetry.tier2_open_data.attempts,
        hits: telemetry.tier2_open_data.hits,
        avgLatencyMs: avgLatency(telemetry.tier2_open_data),
      },
      tier3_dynamic: {
        attempts: telemetry.tier3_dynamic.attempts,
        hits: telemetry.tier3_dynamic.hits,
        avgLatencyMs: avgLatency(telemetry.tier3_dynamic),
      },
      tier4_serp: {
        attempts: telemetry.tier4_serp.attempts,
        hits: telemetry.tier4_serp.hits,
        avgLatencyMs: avgLatency(telemetry.tier4_serp),
      },
    },
    cache: {
      hits: telemetryCacheHits,
      misses: telemetryCacheMisses,
      hitRatio: cacheTotal > 0 ? Number((telemetryCacheHits / cacheTotal).toFixed(3)) : 0,
    },
    fallbackCount: telemetryFallbackCount,
    hostCircuitBreakerSize: hostFailures.size,
  };
}

