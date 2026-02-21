import { fetchUrlTool } from "@/lib/tools/fetch-url";
import type { PackDataSource } from "@/lib/types";
import type {
  RecommendationConstraints,
  RecommendationSignals,
} from "@/lib/repositories/memory";

type CandidateSource = {
  url: string;
  label: string;
  hint?: string;
  origin: "pack" | "web_seed";
};

export type ResearchRecommendation = {
  title: string;
  url: string;
  sourceName: string;
  excerpt: string;
  whyItFits: string;
  noveltyReason: string;
  score: number;
  domain: string;
  imageUrl?: string;
  imageCandidates?: string[];
};

export type ResearchLoopResult = {
  stage: "research_mode";
  candidatesExamined: number;
  sourcesFetched: number;
  recommendations: ResearchRecommendation[];
  notes: string[];
};

type RunResearchLoopInput = {
  userMessage: string;
  tasteHints: string[];
  constraints: RecommendationConstraints;
  signals: RecommendationSignals;
  packDataSources: PackDataSource[];
  maxFetches?: number;
};

function compact(values: string[]) {
  return values.map((v) => v.trim()).filter(Boolean);
}

function dedupeByUrl(candidates: CandidateSource[]) {
  const seen = new Set<string>();
  const out: CandidateSource[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.url)) continue;
    seen.add(candidate.url);
    out.push(candidate);
  }
  return out;
}

function domainFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function sanitizeExcerpt(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 260);
}

function buildSeedCandidates(input: RunResearchLoopInput) {
  const candidates: CandidateSource[] = [];
  const queryParts = compact([
    ...input.constraints.categories,
    ...input.constraints.vibes,
    ...input.constraints.locations,
    input.userMessage,
  ]);
  const query = encodeURIComponent(queryParts.join(" ").slice(0, 120));
  const location = encodeURIComponent(input.constraints.locations[0] ?? "global");

  for (const source of input.packDataSources) {
    candidates.push({
      url: source.url,
      label: source.label || domainFor(source.url),
      hint: source.hint,
      origin: "pack",
    });
  }

  candidates.push(
    {
      url: `https://www.eventbrite.com/d/${location}/${query}`,
      label: "Eventbrite",
      hint: "events, tickets, dates, locations, pricing",
      origin: "web_seed",
    },
    {
      url: `https://www.timeout.com/search?q=${query}`,
      label: "Time Out",
      hint: "curated local recommendations and guide listings",
      origin: "web_seed",
    },
    {
      url: `https://www.tripadvisor.com/Search?q=${query}`,
      label: "Tripadvisor",
      hint: "top places, rankings, and ratings",
      origin: "web_seed",
    },
    {
      url: `https://www.reddit.com/search/?q=${query}`,
      label: "Reddit",
      hint: "community suggestions and local threads",
      origin: "web_seed",
    },
    {
      url: `https://www.google.com/search?q=${query}`,
      label: "Google",
      hint: "fresh sources, directories, and official pages",
      origin: "web_seed",
    },
  );

  return dedupeByUrl(candidates);
}

function scoreSource(input: {
  title: string;
  content: string;
  candidate: CandidateSource;
  terms: string[];
  seenDomains: Set<string>;
  signals: RecommendationSignals;
}) {
  const body = `${input.title} ${input.content}`.toLowerCase();
  const tokenMatches = input.terms.filter((term) => body.includes(term.toLowerCase())).length;
  const relevance = Math.min(5, tokenMatches);
  const nowYear = new Date().getFullYear();
  const freshness = body.includes(String(nowYear)) || body.includes(String(nowYear - 1)) ? 2 : 0.5;
  const domain = domainFor(input.candidate.url);
  const domainNovelty = input.seenDomains.has(domain) ? 0.5 : 2;
  const trust = input.candidate.url.startsWith("https://") ? 1.5 : 0.5;
  const packBonus = input.candidate.origin === "pack" ? 1 : 0;
  const freshBias = input.signals.noveltyPreference === "fresh" ? domainNovelty : 0;

  return relevance + freshness + domainNovelty + trust + packBonus + freshBias;
}

export async function runResearchLoop(input: RunResearchLoopInput): Promise<ResearchLoopResult> {
  const candidates = buildSeedCandidates(input);
  const maxFetches = Math.max(3, Math.min(input.maxFetches ?? 6, 10));
  const notes: string[] = [];
  const scored: ResearchRecommendation[] = [];
  const seenDomains = new Set<string>();
  const dislikedPatterns = new Set(input.constraints.dislikedSourcePatterns);
  const terms = compact([
    ...input.tasteHints,
    ...input.constraints.categories,
    ...input.constraints.vibes,
    ...input.constraints.locations,
    ...input.constraints.timeWindows,
    input.userMessage,
  ]);

  for (const candidate of candidates.slice(0, maxFetches)) {
    const domain = domainFor(candidate.url);
    if (Array.from(dislikedPatterns).some((pattern) => domain.includes(pattern))) {
      notes.push(`Skipped ${domain} due to disliked source pattern.`);
      continue;
    }

    const raw = await fetchUrlTool.execute({
      url: candidate.url,
      hint: candidate.hint ?? terms.slice(0, 5).join(" "),
    });

    if ("error" in raw) {
      notes.push(`Fetch failed for ${candidate.label}: ${raw.error}`);
      continue;
    }

    const title = (typeof raw.title === "string" && raw.title.trim()) || candidate.label;
    const content = typeof raw.content === "string" ? raw.content : "";
    if (!content.trim()) {
      notes.push(`No readable content from ${candidate.label}.`);
      continue;
    }

    const score = scoreSource({
      title,
      content,
      candidate,
      terms,
      seenDomains,
      signals: input.signals,
    });
    const excerpt = sanitizeExcerpt(content);
    const matchedTerms = terms.filter((term) => term.length > 2 && content.toLowerCase().includes(term.toLowerCase()));
    const whyItFits = matchedTerms.length
      ? `Matches your preferences around ${matchedTerms.slice(0, 3).join(", ")}.`
      : "Matches your request intent and recency constraints.";
    const noveltyReason = seenDomains.has(domain)
      ? "Useful corroboration from a known source."
      : "Adds a new source domain for better originality.";

    scored.push({
      title,
      url: candidate.url,
      sourceName: candidate.label,
      excerpt,
      whyItFits,
      noveltyReason,
      score,
      domain,
      imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : undefined,
      imageCandidates: Array.isArray(raw.imageCandidates)
        ? raw.imageCandidates.filter((value): value is string => typeof value === "string").slice(0, 4)
        : undefined,
    });
    seenDomains.add(domain);
  }

  scored.sort((a, b) => b.score - a.score);

  const picked: ResearchRecommendation[] = [];
  const pickedDomains = new Set<string>();
  for (const item of scored) {
    if (picked.length >= 4) break;
    if (pickedDomains.has(item.domain) && pickedDomains.size >= input.signals.sourceDiversityTarget) {
      continue;
    }
    picked.push(item);
    pickedDomains.add(item.domain);
  }

  return {
    stage: "research_mode",
    candidatesExamined: candidates.length,
    sourcesFetched: scored.length,
    recommendations: picked,
    notes,
  };
}
