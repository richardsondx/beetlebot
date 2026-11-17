import type { IconName } from "@/components/ui/icons";

export type TintName = "amber" | "green" | "blue" | "rose" | "violet" | "slate";

export const TINTS: TintName[] = ["amber", "green", "blue", "rose", "violet", "slate"];

export const TINT_CLASSES: Record<TintName, { bg: string; icon: string }> = {
  amber: { bg: "bg-[#FBF1E1]", icon: "text-[#A96B12]" },
  green: { bg: "bg-[#E6F4EA]", icon: "text-[#2F7D4F]" },
  blue: { bg: "bg-[#E5EFFB]", icon: "text-[#2F5FA8]" },
  rose: { bg: "bg-[#FBE8EC]", icon: "text-[#B0405A]" },
  violet: { bg: "bg-[#EFEAFB]", icon: "text-[#6146A8]" },
  slate: { bg: "bg-[#EEF0F3]", icon: "text-[#4A5361]" },
};

export type PackVisual = { icon: IconName; tint: TintName };

export const PACK_ICONS: Record<string, PackVisual> = {
  "holidays-canada": { icon: "Flag", tint: "rose" },
  "toronto-date-night-pack": { icon: "Heart", tint: "rose" },
  "rainy-day-rescue": { icon: "CloudRain", tint: "blue" },
  "toronto-events-scout": { icon: "Ticket", tint: "amber" },
  "toronto-scandinavian-spa-trail": { icon: "Flame", tint: "amber" },
  "toronto-group-wellness-experiences": { icon: "Users", tint: "violet" },
  "ontario-parks-camping-reservations": { icon: "Tent", tint: "green" },
  "parks-canada-campgrounds": { icon: "Mountain", tint: "green" },
  "camping-spots-finder-canada": { icon: "Compass", tint: "green" },
  "flights-compare": { icon: "Plane", tint: "blue" },
  "hotels-compare": { icon: "BedDouble", tint: "slate" },
  "weekend-escape": { icon: "Car", tint: "amber" },
  "family-trip": { icon: "Baby", tint: "violet" },
  "solo-city-break": { icon: "Footprints", tint: "slate" },
  "business-trip": { icon: "Briefcase", tint: "slate" },
};

function hashSlug(slug: string): number {
  let sum = 0;
  for (const ch of slug) sum += ch.charCodeAt(0);
  return sum;
}

/** Fixed slug→icon map; unknown slugs get a stable Puzzle fallback. */
export function getPackVisual(slug: string): PackVisual {
  const known = PACK_ICONS[slug];
  if (known) return known;
  return { icon: "Puzzle", tint: TINTS[hashSlug(slug) % TINTS.length] };
}
