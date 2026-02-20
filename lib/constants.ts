export type ModeDefinition = {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
  activeColor: string;
};

export const PLANNING_MODES: ModeDefinition[] = [
  {
    id: "explore",
    label: "Explore",
    icon: "\u{1F5FA}\uFE0F",
    description: "Discover new things in your city.",
    color: "text-slate-300",
    activeColor: "text-amber-200 border-amber-300/30 bg-amber-300/10",
  },
  {
    id: "dating",
    label: "Date Night",
    icon: "\u{1F4AB}",
    description: "Romantic plans with fallbacks.",
    color: "text-slate-300",
    activeColor: "text-rose-200 border-rose-300/30 bg-rose-300/10",
  },
  {
    id: "family",
    label: "Family",
    icon: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}",
    description: "Family-friendly activities.",
    color: "text-slate-300",
    activeColor: "text-teal-200 border-teal-300/30 bg-teal-300/10",
  },
  {
    id: "social",
    label: "Social",
    icon: "\u{1F389}",
    description: "Group plans and gatherings.",
    color: "text-slate-300",
    activeColor: "text-violet-200 border-violet-300/30 bg-violet-300/10",
  },
  {
    id: "relax",
    label: "Relax",
    icon: "\u{1F33F}",
    description: "Low-key, zero-stress plans.",
    color: "text-slate-300",
    activeColor: "text-emerald-200 border-emerald-300/30 bg-emerald-300/10",
  },
  {
    id: "travel",
    label: "Travel",
    icon: "\u2708\uFE0F",
    description: "Trips, itineraries, buffers.",
    color: "text-slate-300",
    activeColor: "text-sky-200 border-sky-300/30 bg-sky-300/10",
  },
  {
    id: "focus",
    label: "Focus",
    icon: "\u{1F3AF}",
    description: "Deep work and scheduling blocks.",
    color: "text-slate-300",
    activeColor: "text-orange-200 border-orange-300/30 bg-orange-300/10",
  },
];

export const CHAT_MODES: ModeDefinition[] = [
  {
    id: "auto",
    label: "Auto",
    icon: "\u2728",
    description: "We'll pick the best plan type for you.",
    color: "text-slate-300",
    activeColor: "text-cyan-200 border-cyan-300/30 bg-cyan-300/10",
  },
  ...PLANNING_MODES,
];

export const DEFAULT_CHAT_MODE = CHAT_MODES[0];

export const MODE_IDS = PLANNING_MODES.map((m) => m.id);
export const CHAT_MODE_IDS = CHAT_MODES.map((m) => m.id);

export type StyleDefinition = {
  id: string;
  label: string;
  description: string;
};

export const STYLES: StyleDefinition[] = [
  { id: "chill", label: "Chill", description: "Laid-back, go-with-the-flow plans." },
  { id: "predictable", label: "Predictable", description: "Structured plans with clear timelines." },
  { id: "spontaneous", label: "Spontaneous", description: "Last-minute, seize-the-moment energy." },
  { id: "curated", label: "Curated", description: "Hand-picked, high-quality selections." },
  { id: "budget", label: "Budget", description: "Maximize value, minimize spend." },
  { id: "luxe", label: "Luxe", description: "Premium experiences, no cutting corners." },
];

export const STYLE_IDS = STYLES.map((s) => s.id);

export type PermissionDefinition = {
  key: string;
  integration: string;
  integrationIcon: string;
  label: string;
  description: string;
};

export type PermissionGroup = {
  integration: string;
  integrationIcon: string;
  permissions: PermissionDefinition[];
};

export const PERMISSIONS: PermissionDefinition[] = [
  {
    key: "calendar:read",
    integration: "Google Calendar",
    integrationIcon: "📅",
    label: "Read calendar",
    description: "Check availability and scheduled events",
  },
  {
    key: "calendar:write",
    integration: "Google Calendar",
    integrationIcon: "📅",
    label: "Edit calendar",
    description: "Create and modify calendar events",
  },
  {
    key: "weather:read",
    integration: "Weather",
    integrationIcon: "🌤",
    label: "Weather forecast",
    description: "Get current conditions and forecasts",
  },
  {
    key: "reservations:read",
    integration: "OpenTable",
    integrationIcon: "🍽️",
    label: "Search restaurants",
    description: "Find and check restaurant availability",
  },
  {
    key: "reservations:write",
    integration: "OpenTable",
    integrationIcon: "🍽️",
    label: "Make reservations",
    description: "Book tables at restaurants",
  },
  {
    key: "maps:read",
    integration: "Maps",
    integrationIcon: "🗺️",
    label: "Directions & distance",
    description: "Estimate travel time and get directions",
  },
];

export const PERMISSION_GROUPS: PermissionGroup[] = Object.values(
  PERMISSIONS.reduce<Record<string, PermissionGroup>>((acc, p) => {
    if (!acc[p.integration]) {
      acc[p.integration] = {
        integration: p.integration,
        integrationIcon: p.integrationIcon,
        permissions: [],
      };
    }
    acc[p.integration].permissions.push(p);
    return acc;
  }, {}),
);
