// ── Climate zone types ──────────────────────────────────────────────────────

export type ClimateZone =
  | "temperate"
  | "mediterranean"
  | "tropical_wet_dry"
  | "tropical_equatorial"
  | "arid"
  | "subarctic";

type Hemisphere = "northern" | "southern";
type LocationClimate = { zone: ClimateZone; lat: number };

type SeasonalProfile = {
  phase: string;
  daylightNote: string;
  strong: string[];
  avoid: string[];
  caveat: string;
};

// ── Timezone → climate zone + approximate latitude ──────────────────────────
// Covers ~90 major timezone identifiers. Hemisphere is derived from latitude
// sign so southern-hemisphere cities flip correctly without manual flags.

const TIMEZONE_CLIMATE: Record<string, LocationClimate> = {
  // ── Americas: Temperate ──
  "America/Toronto": { zone: "temperate", lat: 43.7 },
  "America/Montreal": { zone: "temperate", lat: 45.5 },
  "America/New_York": { zone: "temperate", lat: 40.7 },
  "America/Chicago": { zone: "temperate", lat: 41.9 },
  "America/Denver": { zone: "temperate", lat: 39.7 },
  "America/Vancouver": { zone: "temperate", lat: 49.3 },
  "America/Edmonton": { zone: "temperate", lat: 53.5 },
  "America/Winnipeg": { zone: "temperate", lat: 49.9 },
  "America/Halifax": { zone: "temperate", lat: 44.6 },
  "America/St_Johns": { zone: "temperate", lat: 47.6 },
  "America/Detroit": { zone: "temperate", lat: 42.3 },
  "America/Indiana/Indianapolis": { zone: "temperate", lat: 39.8 },
  "America/Buenos_Aires": { zone: "temperate", lat: -34.6 },
  "America/Argentina/Buenos_Aires": { zone: "temperate", lat: -34.6 },
  // ── Americas: Mediterranean ──
  "America/Los_Angeles": { zone: "mediterranean", lat: 34.1 },
  "America/Santiago": { zone: "mediterranean", lat: -33.4 },
  // ── Americas: Tropical wet-dry ──
  "America/Mexico_City": { zone: "tropical_wet_dry", lat: 19.4 },
  "America/Cancun": { zone: "tropical_wet_dry", lat: 21.2 },
  "America/Havana": { zone: "tropical_wet_dry", lat: 23.1 },
  "America/Santo_Domingo": { zone: "tropical_wet_dry", lat: 18.5 },
  "America/Jamaica": { zone: "tropical_wet_dry", lat: 18.1 },
  "America/Port-au-Prince": { zone: "tropical_wet_dry", lat: 18.5 },
  "America/Sao_Paulo": { zone: "tropical_wet_dry", lat: -23.5 },
  "America/Rio_de_Janeiro": { zone: "tropical_wet_dry", lat: -22.9 },
  "America/Costa_Rica": { zone: "tropical_wet_dry", lat: 9.9 },
  "America/Panama": { zone: "tropical_wet_dry", lat: 9.0 },
  // ── Americas: Tropical equatorial ──
  "America/Bogota": { zone: "tropical_equatorial", lat: 4.7 },
  "America/Guayaquil": { zone: "tropical_equatorial", lat: -2.2 },
  "America/Manaus": { zone: "tropical_equatorial", lat: -3.1 },
  "America/Belem": { zone: "tropical_equatorial", lat: -1.5 },
  // ── Americas: Arid ──
  "America/Phoenix": { zone: "arid", lat: 33.4 },
  "America/Lima": { zone: "arid", lat: -12.0 },
  // ── Americas: Subarctic ──
  "America/Anchorage": { zone: "subarctic", lat: 61.2 },
  "America/Juneau": { zone: "subarctic", lat: 58.3 },
  "America/Whitehorse": { zone: "subarctic", lat: 60.7 },
  "America/Yellowknife": { zone: "subarctic", lat: 62.5 },

  // ── Europe: Temperate ──
  "Europe/London": { zone: "temperate", lat: 51.5 },
  "Europe/Paris": { zone: "temperate", lat: 48.9 },
  "Europe/Berlin": { zone: "temperate", lat: 52.5 },
  "Europe/Amsterdam": { zone: "temperate", lat: 52.4 },
  "Europe/Brussels": { zone: "temperate", lat: 50.8 },
  "Europe/Zurich": { zone: "temperate", lat: 47.4 },
  "Europe/Vienna": { zone: "temperate", lat: 48.2 },
  "Europe/Warsaw": { zone: "temperate", lat: 52.2 },
  "Europe/Prague": { zone: "temperate", lat: 50.1 },
  "Europe/Budapest": { zone: "temperate", lat: 47.5 },
  "Europe/Bucharest": { zone: "temperate", lat: 44.4 },
  "Europe/Dublin": { zone: "temperate", lat: 53.3 },
  "Europe/Copenhagen": { zone: "temperate", lat: 55.7 },
  "Europe/Moscow": { zone: "temperate", lat: 55.8 },
  "Europe/Kiev": { zone: "temperate", lat: 50.5 },
  // ── Europe: Mediterranean ──
  "Europe/Madrid": { zone: "mediterranean", lat: 40.4 },
  "Europe/Rome": { zone: "mediterranean", lat: 41.9 },
  "Europe/Athens": { zone: "mediterranean", lat: 37.9 },
  "Europe/Istanbul": { zone: "mediterranean", lat: 41.0 },
  "Europe/Lisbon": { zone: "mediterranean", lat: 38.7 },
  // ── Europe: Subarctic ──
  "Europe/Stockholm": { zone: "subarctic", lat: 59.3 },
  "Europe/Helsinki": { zone: "subarctic", lat: 60.2 },
  "Europe/Oslo": { zone: "subarctic", lat: 59.9 },
  "Atlantic/Reykjavik": { zone: "subarctic", lat: 64.1 },

  // ── Africa: Tropical wet-dry ──
  "Africa/Lagos": { zone: "tropical_wet_dry", lat: 6.5 },
  "Africa/Accra": { zone: "tropical_wet_dry", lat: 5.6 },
  "Africa/Dakar": { zone: "tropical_wet_dry", lat: 14.7 },
  "Africa/Abidjan": { zone: "tropical_wet_dry", lat: 5.3 },
  "Africa/Douala": { zone: "tropical_wet_dry", lat: 4.1 },
  "Africa/Addis_Ababa": { zone: "tropical_wet_dry", lat: 9.0 },
  "Africa/Dar_es_Salaam": { zone: "tropical_wet_dry", lat: -6.8 },
  "Africa/Maputo": { zone: "tropical_wet_dry", lat: -25.9 },
  "Africa/Lusaka": { zone: "tropical_wet_dry", lat: -15.4 },
  "Africa/Harare": { zone: "tropical_wet_dry", lat: -17.8 },
  // ── Africa: Tropical equatorial ──
  "Africa/Nairobi": { zone: "tropical_equatorial", lat: -1.3 },
  "Africa/Kinshasa": { zone: "tropical_equatorial", lat: -4.3 },
  "Africa/Kampala": { zone: "tropical_equatorial", lat: 0.3 },
  "Africa/Brazzaville": { zone: "tropical_equatorial", lat: -4.3 },
  "Africa/Libreville": { zone: "tropical_equatorial", lat: 0.4 },
  // ── Africa: Arid ──
  "Africa/Cairo": { zone: "arid", lat: 30.0 },
  "Africa/Khartoum": { zone: "arid", lat: 15.6 },
  // ── Africa: Mediterranean ──
  "Africa/Casablanca": { zone: "mediterranean", lat: 33.6 },
  "Africa/Tunis": { zone: "mediterranean", lat: 36.8 },
  "Africa/Algiers": { zone: "mediterranean", lat: 36.8 },
  // ── Africa: Temperate ──
  "Africa/Johannesburg": { zone: "temperate", lat: -26.2 },
  "Africa/Cape_Town": { zone: "mediterranean", lat: -33.9 },

  // ── Asia: Temperate ──
  "Asia/Tokyo": { zone: "temperate", lat: 35.7 },
  "Asia/Seoul": { zone: "temperate", lat: 37.6 },
  "Asia/Shanghai": { zone: "temperate", lat: 31.2 },
  "Asia/Almaty": { zone: "temperate", lat: 43.2 },
  // ── Asia: Tropical wet-dry ──
  "Asia/Bangkok": { zone: "tropical_wet_dry", lat: 13.8 },
  "Asia/Ho_Chi_Minh": { zone: "tropical_wet_dry", lat: 10.8 },
  "Asia/Manila": { zone: "tropical_wet_dry", lat: 14.6 },
  "Asia/Kolkata": { zone: "tropical_wet_dry", lat: 22.6 },
  "Asia/Colombo": { zone: "tropical_wet_dry", lat: 6.9 },
  "Asia/Dhaka": { zone: "tropical_wet_dry", lat: 23.8 },
  "Asia/Yangon": { zone: "tropical_wet_dry", lat: 16.9 },
  "Asia/Hong_Kong": { zone: "tropical_wet_dry", lat: 22.3 },
  "Asia/Taipei": { zone: "tropical_wet_dry", lat: 25.0 },
  // ── Asia: Tropical equatorial ──
  "Asia/Singapore": { zone: "tropical_equatorial", lat: 1.4 },
  "Asia/Kuala_Lumpur": { zone: "tropical_equatorial", lat: 3.1 },
  "Asia/Jakarta": { zone: "tropical_equatorial", lat: -6.2 },
  "Asia/Makassar": { zone: "tropical_equatorial", lat: -5.1 },
  // ── Asia: Arid ──
  "Asia/Dubai": { zone: "arid", lat: 25.2 },
  "Asia/Riyadh": { zone: "arid", lat: 24.7 },
  "Asia/Qatar": { zone: "arid", lat: 25.3 },
  "Asia/Muscat": { zone: "arid", lat: 23.6 },
  "Asia/Kuwait": { zone: "arid", lat: 29.4 },
  "Asia/Baghdad": { zone: "arid", lat: 33.3 },
  "Asia/Karachi": { zone: "arid", lat: 24.9 },
  "Asia/Tehran": { zone: "arid", lat: 35.7 },
  "Asia/Tashkent": { zone: "arid", lat: 41.3 },
  // ── Asia: Mediterranean ──
  "Asia/Beirut": { zone: "mediterranean", lat: 33.9 },
  "Asia/Jerusalem": { zone: "mediterranean", lat: 31.8 },
  "Asia/Nicosia": { zone: "mediterranean", lat: 35.2 },

  // ── Oceania ──
  "Australia/Sydney": { zone: "temperate", lat: -33.9 },
  "Australia/Melbourne": { zone: "temperate", lat: -37.8 },
  "Australia/Hobart": { zone: "temperate", lat: -42.9 },
  "Australia/Perth": { zone: "mediterranean", lat: -31.9 },
  "Australia/Adelaide": { zone: "mediterranean", lat: -34.9 },
  "Australia/Brisbane": { zone: "tropical_wet_dry", lat: -27.5 },
  "Australia/Darwin": { zone: "tropical_wet_dry", lat: -12.5 },
  "Pacific/Auckland": { zone: "temperate", lat: -36.9 },
  "Pacific/Fiji": { zone: "tropical_wet_dry", lat: -18.1 },
  "Pacific/Honolulu": { zone: "tropical_equatorial", lat: 21.3 },
  "Pacific/Guam": { zone: "tropical_equatorial", lat: 13.4 },
};

// Fallback by timezone region prefix when the specific ID isn't mapped.
const REGION_DEFAULTS: Record<string, LocationClimate> = {
  "America/": { zone: "temperate", lat: 40 },
  "US/": { zone: "temperate", lat: 40 },
  "Canada/": { zone: "temperate", lat: 45 },
  "Europe/": { zone: "temperate", lat: 48 },
  "Africa/": { zone: "tropical_wet_dry", lat: 8 },
  "Asia/": { zone: "tropical_wet_dry", lat: 20 },
  "Australia/": { zone: "temperate", lat: -30 },
  "Pacific/": { zone: "tropical_equatorial", lat: -5 },
  "Indian/": { zone: "tropical_equatorial", lat: -8 },
  "Atlantic/": { zone: "temperate", lat: 45 },
  "Arctic/": { zone: "subarctic", lat: 70 },
  "Antarctica/": { zone: "subarctic", lat: -75 },
};

const GLOBAL_DEFAULT: LocationClimate = { zone: "temperate", lat: 43.7 };

// ── Climate resolution ──────────────────────────────────────────────────────

function resolveClimate(timezone: string): LocationClimate & { hemisphere: Hemisphere } {
  const tz = timezone || "America/Toronto";

  let match = TIMEZONE_CLIMATE[tz];
  if (!match) {
    const prefix = Object.keys(REGION_DEFAULTS).find((p) => tz.startsWith(p));
    match = prefix ? REGION_DEFAULTS[prefix] : GLOBAL_DEFAULT;
  }

  return { ...match, hemisphere: match.lat >= 0 ? "northern" : "southern" };
}

// ── Daylight estimation ─────────────────────────────────────────────────────
// Uses the standard sunrise equation approximation. Accuracy is within ~20 min
// which is plenty for activity-planning guidance.

function estimateDaylightHours(latDeg: number, month: number): number {
  const latRad = (latDeg * Math.PI) / 180;
  const dayOfYear = (month - 1) * 30.44 + 15;
  const declination = 23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));
  const declRad = (declination * Math.PI) / 180;
  const cosHourAngle = -Math.tan(latRad) * Math.tan(declRad);
  if (cosHourAngle <= -1) return 24;
  if (cosHourAngle >= 1) return 0;
  return (2 * Math.acos(cosHourAngle) * 12) / Math.PI;
}

function formatDaylightNote(hours: number): string {
  const h = Math.round(hours);
  if (hours >= 23) return "near-24-hour daylight (midnight sun)";
  if (hours <= 1) return "near-zero daylight (polar night)";
  const approxSunset = Math.round(12 + hours / 2);
  const sunsetLabel = approxSunset >= 21 ? "9 pm+" : approxSunset >= 20 ? "~8 pm" : approxSunset >= 19 ? "~7 pm" : approxSunset >= 18 ? "~6 pm" : approxSunset >= 17 ? "~5 pm" : approxSunset >= 16 ? "~4 pm" : `~${approxSunset > 12 ? approxSunset - 12 : approxSunset} pm`;
  return `roughly ${h} hours of daylight; dark around ${sunsetLabel}`;
}

// ── Season phase resolution per climate zone ────────────────────────────────
// Each zone defines its own set of meaningful phases. Month ranges account
// for hemisphere by flipping 6 months for southern locations.

function adjustMonth(month: number, hemisphere: Hemisphere): number {
  if (hemisphere === "southern") return ((month + 5) % 12) + 1;
  return month;
}

function getTemperatePhase(month: number, hemisphere: Hemisphere) {
  const m = adjustMonth(month, hemisphere);
  if (m === 12 || m <= 2) return "winter" as const;
  if (m <= 5) return "spring" as const;
  if (m <= 8) return "summer" as const;
  return "fall" as const;
}

function getMediterraneanPhase(month: number, hemisphere: Hemisphere) {
  const m = adjustMonth(month, hemisphere);
  if (m >= 6 && m <= 9) return "hot_dry" as const;
  if (m >= 11 || m <= 2) return "cool_wet" as const;
  return "transition" as const;
}

function getTropicalWetDryPhase(month: number, hemisphere: Hemisphere) {
  const m = adjustMonth(month, hemisphere);
  if (m >= 5 && m <= 10) return "wet" as const;
  return "dry" as const;
}

function getTropicalEquatorialPhase(_month: number) {
  return "year_round_warm" as const;
}

function getAridPhase(month: number, hemisphere: Hemisphere) {
  const m = adjustMonth(month, hemisphere);
  if (m >= 4 && m <= 10) return "hot" as const;
  return "cool" as const;
}

function getSubarcticPhase(month: number, hemisphere: Hemisphere) {
  const m = adjustMonth(month, hemisphere);
  if (m >= 11 || m <= 2) return "deep_winter" as const;
  if (m >= 6 && m <= 8) return "brief_summer" as const;
  if (m <= 5) return "spring_thaw" as const;
  return "autumn_dark" as const;
}

// ── Activity profiles per zone + phase ──────────────────────────────────────

const TEMPERATE_PROFILES: Record<string, Omit<SeasonalProfile, "daylightNote">> = {
  winter: {
    phase: "winter",
    strong: [
      "ice skating, snowshoeing, winter hiking, ski/snowboard day trips",
      "seasonal winter events, holiday markets, winter festivals",
      "cozy indoor dining — fondue, hot pot, ramen, fireplace spots, wine bars",
      "museums, galleries, escape rooms, bowling, arcade bars, live music",
      "heated indoor experiences: cooking classes, spa days, pottery, cinema",
    ],
    avoid: [
      "patios as a default — most are physically closed in winter; only mention heated-patio as a novelty",
      "beach outings or outdoor water activities",
      "outdoor farmers markets and open-air festivals (mostly on hiatus)",
    ],
    caveat:
      "If live weather shows an unusually mild day (above 8–10 °C), acknowledge it and offer a secondary outdoor option like a park walk or short trail.",
  },
  spring: {
    phase: "spring",
    strong: [
      "spring bloom and cherry blossom viewing in local parks",
      "patios beginning to open (mid-to-late spring onwards)",
      "cycling, walking trails, light hiking as paths dry out",
      "outdoor markets and spring festivals restarting",
      "golf courses, tennis courts, and outdoor sports reopening",
    ],
    avoid: [
      "assuming fully open patio season early in spring",
      "heavy outdoor plans without an indoor fallback (spring weather is unpredictable)",
    ],
    caveat:
      "Spring is a transition: early spring still leans indoor-heavy, late spring is solidly outdoor-friendly. Weight suggestions by how deep into spring the date falls.",
  },
  summer: {
    phase: "summer",
    strong: [
      "patios, rooftop bars, beer gardens — peak outdoor dining season",
      "beaches, swimming, kayaking, paddleboarding, outdoor pools",
      "outdoor concerts, street festivals, night markets, food festivals",
      "cycling, hiking, park picnics, outdoor yoga/fitness",
      "late-evening outdoor events taking advantage of long daylight",
    ],
    avoid: [
      "defaulting to indoor-only options when conditions are fine — summer is peak outdoor season",
      "overloading daytime schedules in heat waves without shade/AC breaks",
    ],
    caveat:
      "If live temperature exceeds 32 °C, flag the heat and suggest shaded or air-conditioned alternatives as primary. Recommend early morning or evening timing.",
  },
  fall: {
    phase: "fall",
    strong: [
      "fall foliage hikes, apple picking, harvest festivals, scenic drives",
      "cozy restaurant season: braised dishes, mulled cider, warm cocktails",
      "film and arts festivals, gallery openings (cultural season starts)",
      "farmers markets in their final weeks before winter closure",
      "patios still viable in early fall, winding down by late fall",
    ],
    avoid: [
      "beach outings in late fall",
      "assuming summer patio season is still in full swing by late fall",
    ],
    caveat:
      "Fall is two phases: early fall (September) feels like late summer — lean outdoor; late fall (November) feels like early winter — lean cozy indoor.",
  },
};

const MEDITERRANEAN_PROFILES: Record<string, Omit<SeasonalProfile, "daylightNote">> = {
  hot_dry: {
    phase: "hot-dry season (summer)",
    strong: [
      "beach, coastal activities, swimming, snorkeling, sailing",
      "outdoor terraces, rooftop bars, seaside dining — peak season",
      "evening and night markets, open-air cinema, outdoor festivals",
      "early morning or sunset outdoor activities (avoid midday heat)",
      "mountain or highland day trips for cooler temperatures",
    ],
    avoid: [
      "strenuous midday outdoor activities (extreme heat risk, often 35–42 °C)",
      "expecting lush green landscapes (vegetation is typically dry/brown)",
    ],
    caveat:
      "Peak heat in mid-summer can be extreme inland. Recommend early morning or late evening for outdoor plans. Coastal areas are significantly more bearable than inland.",
  },
  cool_wet: {
    phase: "cool-wet season (winter)",
    strong: [
      "cultural venues: museums, galleries, theaters, historic sites (fewer tourists)",
      "cozy restaurants, wine bars, indoor food markets, tapas crawls",
      "hiking and walking — mild temperatures ideal for exercise outdoors",
      "urban exploration without tourist crowds",
      "hot springs, spa days, thermal baths",
    ],
    avoid: [
      "assuming harsh-winter gear is needed — winters are mild (8–16 °C typically)",
      "beach/swim days (water is cold, weather unpredictable)",
    ],
    caveat:
      "Rain is intermittent, not constant. Many outdoor activities are still viable between showers. Layer for mild cool, not extreme cold.",
  },
  transition: {
    phase: "shoulder season (spring/autumn transition)",
    strong: [
      "ideal outdoor sightseeing weather — moderate temperatures, pleasant breezes",
      "hiking, cycling, nature walks at their most comfortable",
      "al fresco dining returning (spring) or in its last stretch (autumn)",
      "wine harvest and food festivals (autumn), flower festivals (spring)",
      "fewer tourists than peak summer — great for popular attractions",
    ],
    avoid: [
      "assuming full summer heat has arrived (spring) or still lingers (autumn)",
      "skipping layers — evenings can be significantly cooler than midday",
    ],
    caveat:
      "Shoulder seasons are often the best time for outdoor activities in Mediterranean climates. Temperatures are moderate (18–28 °C) without the extremes of summer heat.",
  },
};

const TROPICAL_WET_DRY_PROFILES: Record<string, Omit<SeasonalProfile, "daylightNote">> = {
  wet: {
    phase: "wet / rainy / monsoon season",
    strong: [
      "indoor cultural experiences: museums, temples, cooking classes, craft workshops",
      "shopping malls, indoor markets, food halls, street-food arcades with shelter",
      "spa, wellness, and massage — popular rainy-day activities",
      "morning outdoor excursions (mornings are often clearer before afternoon downpours)",
      "waterfall visits and lush-green nature (rivers are full, landscapes at their most vibrant)",
    ],
    avoid: [
      "full-day outdoor itineraries (heavy afternoon downpours are common and can be torrential)",
      "assuming it rains all day — tropical rain is typically a heavy burst, not all-day drizzle",
      "island hopping or beach plans without checking local advisories (some boat services reduce)",
    ],
    caveat:
      "Mornings are often clear and excellent for outdoor activities. Plan outdoor time for the first half of the day with indoor backup for afternoons. Evening thunderstorms are common but usually pass.",
  },
  dry: {
    phase: "dry season",
    strong: [
      "beach, coastal, and island activities — peak conditions",
      "outdoor markets, night markets, street food, open-air dining",
      "hiking, cycling, outdoor sightseeing — most comfortable time of year",
      "cultural festivals and outdoor events (many fall in dry season)",
      "wildlife viewing, nature excursions, national park visits",
    ],
    avoid: [
      "underestimating heat and humidity (still tropical — 30 °C+ is normal)",
      "over-scheduling intense outdoor activities without shade and hydration breaks",
    ],
    caveat:
      "Dry doesn't mean cool. Temperatures are often 30 °C+ with high humidity. Recommend hydration breaks and prefer early morning or late afternoon for intense outdoor activities.",
  },
};

const TROPICAL_EQUATORIAL_PROFILES: Record<string, Omit<SeasonalProfile, "daylightNote">> = {
  year_round_warm: {
    phase: "year-round warm (minimal seasonality)",
    strong: [
      "outdoor activities are viable every day with a rain contingency plan",
      "mix indoor and outdoor plans freely — flexibility is the norm here",
      "tropical gardens, botanical parks, urban green spaces",
      "water activities year-round (ocean/pool water is always warm)",
      "vibrant street food culture, hawker centres, night markets",
      "early morning activities before afternoon heat builds",
    ],
    avoid: [
      "planning rigid all-day outdoor schedules (brief heavy rain can appear any day)",
      "assuming there are strong seasonal patterns — there aren't",
      "scheduling strenuous outdoor plans during midday heat (11am–3pm is hottest)",
    ],
    caveat:
      "Equatorial climates have consistent warmth (26–33 °C) year-round with ~12 hours of daylight every day. Brief heavy rain can occur any day. Always have a quick indoor fallback. The real-time weather forecast matters far more than the calendar date.",
  },
};

const ARID_PROFILES: Record<string, Omit<SeasonalProfile, "daylightNote">> = {
  hot: {
    phase: "hot season",
    strong: [
      "air-conditioned malls, indoor entertainment complexes, cinema, bowling",
      "swimming pools, water parks, indoor aquariums",
      "very early morning outdoor activities (before 9am) or after sunset",
      "desert sunset and nighttime experiences (after heat breaks)",
      "indoor cultural venues: museums, art galleries, cultural centres",
    ],
    avoid: [
      "ANY outdoor activity between 10am and 5pm (dangerous heat, often 40–50 °C)",
      "extended outdoor walking or sightseeing during daytime",
      "assuming evening brings cool relief — desert evenings can still be 35 °C+",
    ],
    caveat:
      "Heat is the dominant constraint and can be genuinely dangerous. Nearly all outdoor activity should be before 9am or after sunset. Indoor air-conditioning is not optional — it's a health necessity. Always recommend water and shade.",
  },
  cool: {
    phase: "cool / pleasant season",
    strong: [
      "peak outdoor season: desert hikes, dune excursions, outdoor markets, souks",
      "al fresco dining, rooftop terraces, garden restaurants, outdoor cafes",
      "outdoor sports: cycling, running, golf, tennis, horse riding",
      "cultural festivals and outdoor events (most annual events happen now)",
      "beach activities in coastal desert cities — water is pleasant",
    ],
    avoid: [
      "assuming tropical warmth — nights can drop to 10–15 °C; desert temperature drops are sharp",
      "skipping a light jacket for evening plans",
    ],
    caveat:
      "This is the ideal outdoor season in arid climates. Daytime is pleasant (20–30 °C) but evenings cool rapidly after sunset. Recommend a light jacket for after-dark plans.",
  },
};

const SUBARCTIC_PROFILES: Record<string, Omit<SeasonalProfile, "daylightNote">> = {
  deep_winter: {
    phase: "deep winter",
    strong: [
      "northern lights / aurora viewing (best conditions: clear, dark, cold)",
      "winter sports: cross-country skiing, snowshoeing, snowmobiling, dog sledding",
      "cozy indoor culture: saunas, hot springs, candlelit restaurants, fireside dining",
      "ice fishing, ice hotels, unique Arctic-winter experiences",
      "indoor cultural events, concerts, craft workshops to fill short days",
    ],
    avoid: [
      "extended outdoor plans — extreme cold and possibly only 3–6 hours of usable daylight",
      "underestimating darkness — it may be dark by 2–3pm at high latitudes",
      "treating this as 'regular' winter — subarctic winter is qualitatively different from temperate winter",
    ],
    caveat:
      "Daylight may be extremely limited (under 6 hours in December above 60° latitude). Plan around the brief daylight window for outdoor activities. Embrace darkness-compatible experiences: northern lights, candlelit dining, sauna culture.",
  },
  brief_summer: {
    phase: "brief summer",
    strong: [
      "midnight sun experiences (near-24-hour daylight at peak)",
      "hiking, fjord excursions, kayaking, nature walks — landscapes are spectacular",
      "outdoor festivals celebrating the brief summer season",
      "wildlife viewing, birdwatching, whale watching in coastal areas",
      "late-night outdoor activities (it literally doesn't get dark)",
    ],
    avoid: [
      "assuming warm temperatures — summer is typically 12–22 °C; always bring layers",
      "forgetting about sleep — the endless daylight disrupts sleep patterns (bring an eye mask)",
    ],
    caveat:
      "Subarctic summer is brief and magical with extremely long or continuous daylight. Temperatures are mild, not warm. Layers are essential. Make the most of extended daylight — you can hike at 11pm.",
  },
  spring_thaw: {
    phase: "spring thaw",
    strong: [
      "watching the landscape transform — snowmelt, first green, migrating birds returning",
      "early hiking on cleared trails",
      "indoor cultural events winding down winter season",
      "sauna and hot spring visits remain popular",
    ],
    avoid: [
      "expecting warm weather — spring can still be near-freezing with significant snow cover",
      "mud season on trails (some paths are impassable during melt)",
    ],
    caveat:
      "Spring arrives late in subarctic regions. What feels like 'spring' at temperate latitudes may still look and feel like winter here. Daylight is increasing rapidly week by week, which is the main seasonal signal.",
  },
  autumn_dark: {
    phase: "autumn (rapid darkening)",
    strong: [
      "autumn colour viewing — northern forests turn vivid gold, red, orange",
      "early northern lights season begins as darkness returns",
      "mushroom and berry foraging (popular cultural activity in Nordic regions)",
      "cozy indoor transition: restaurants switch to winter menus, candle season begins",
    ],
    avoid: [
      "assuming temperate-like mild autumn — temperatures drop fast and hard",
      "planning late-afternoon outdoor activities (darkness arrives much earlier week by week)",
    ],
    caveat:
      "Daylight shrinks rapidly — losing several minutes per day. By late autumn, days are very short. Northern lights become visible again. Layer warmly and plan outdoor time around the shrinking daylight window.",
  },
};

// ── Main export ─────────────────────────────────────────────────────────────

const ZONE_LABELS: Record<ClimateZone, string> = {
  temperate: "temperate (4-season)",
  mediterranean: "Mediterranean",
  tropical_wet_dry: "tropical wet-dry",
  tropical_equatorial: "tropical equatorial",
  arid: "arid / desert",
  subarctic: "subarctic / high-latitude",
};

export function buildSeasonContext(timezone?: string): string {
  const tz = timezone || "America/Toronto";
  const climate = resolveClimate(tz);
  const now = new Date();
  const localDate = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const month = localDate.getMonth() + 1;
  const monthName = localDate.toLocaleString("en-US", { month: "long" });

  const { zone, hemisphere, lat } = climate;
  const daylightHours = estimateDaylightHours(lat, month);
  const daylightNote = formatDaylightNote(daylightHours);

  let phase: string;
  let profiles: Record<string, Omit<SeasonalProfile, "daylightNote">>;

  switch (zone) {
    case "temperate":
      phase = getTemperatePhase(month, hemisphere);
      profiles = TEMPERATE_PROFILES;
      break;
    case "mediterranean":
      phase = getMediterraneanPhase(month, hemisphere);
      profiles = MEDITERRANEAN_PROFILES;
      break;
    case "tropical_wet_dry":
      phase = getTropicalWetDryPhase(month, hemisphere);
      profiles = TROPICAL_WET_DRY_PROFILES;
      break;
    case "tropical_equatorial":
      phase = getTropicalEquatorialPhase(month);
      profiles = TROPICAL_EQUATORIAL_PROFILES;
      break;
    case "arid":
      phase = getAridPhase(month, hemisphere);
      profiles = ARID_PROFILES;
      break;
    case "subarctic":
      phase = getSubarcticPhase(month, hemisphere);
      profiles = SUBARCTIC_PROFILES;
      break;
  }

  const profile = profiles[phase];
  const zoneLabel = ZONE_LABELS[zone];
  const strongList = profile.strong.map((s) => `  • ${s}`).join("\n");
  const avoidList = profile.avoid.map((s) => `  • ${s}`).join("\n");

  return [
    `SEASONAL CONTEXT (${monthName}, ${hemisphere} hemisphere, ${zoneLabel} climate → ${profile.phase}):`,
    `Daylight: ${daylightNote}.`,
    `Strong activity candidates this season:\n${strongList}`,
    `Avoid defaulting to:\n${avoidList}`,
    `Seasonal caveat: ${profile.caveat}`,
    "Use season and climate zone to filter what is culturally and physically available. Use the current weather data for today's specific conditions. Both signals should inform recommendations.",
  ].join("\n");
}
