import { db } from "@/lib/db";

export async function ensureSeedData() {
  const autopilotCount = await db.autopilot.count();
  if (autopilotCount === 0) {
    await db.autopilot.createMany({
      data: [
        {
          id: "ap-weekend",
          name: "Empty Weekend + Weather",
          goal: "Fill a free Saturday with a weather-aware plan",
          triggerType: "time",
          trigger: "Friday 12:00",
          action: "Propose full Saturday plan and create soft hold",
          approvalRule: "ask_first",
          status: "on",
          nextCheckIn: new Date(Date.now() + 86400000),
          mode: "explore",
          budgetCap: 180,
        },
        {
          id: "ap-date-night",
          name: "Date Night Operator",
          goal: "Create weekly date-night options under budget",
          triggerType: "time",
          trigger: "Tuesday 15:00",
          action: "Hold 18:00-21:00 and suggest 2 plans",
          approvalRule: "ask_first",
          status: "on",
          nextCheckIn: new Date(Date.now() + 172800000),
          mode: "dating",
          budgetCap: 150,
        },
      ],
    });
  }

  const seedPacks = [
    {
      slug: "holidays-canada",
      name: "Holidays in Canada",
      city: "Canada",
      modes: JSON.stringify(["explore", "social", "dating", "family", "relax"]),
      style: "reference",
      budgetRange: "N/A",
      needs: JSON.stringify(["calendar:read"]),
      description:
        "Canadian statutory and commonly observed holidays — helps adjust plans for closures, travel surges, and long weekends.",
      instructions:
        "Be aware of Canadian statutory and commonly observed holidays when planning. On holidays, expect closures (banks, government services, many shops), reduced transit schedules, and higher demand for restaurants/attractions. Proactively flag when a plan falls on or near a long weekend. Suggest booking earlier and adding extra travel buffer. If planning for a holiday Monday or Friday, prioritize flexible options and have indoor backups.",
      tags: JSON.stringify(["holidays", "canada", "long-weekends", "closures"]),
      dataSources: JSON.stringify([
        {
          url: "https://www.canada.ca/en/department-finance/services/publications/federal-government-public-holidays.html",
          label: "Government of Canada — Public holidays",
          hint: "Official Canadian federal public holidays",
        },
      ]),
      installed: false,
    },
    {
      slug: "toronto-date-night-pack",
      name: "Toronto Date Night Pack",
      city: "Toronto",
      modes: JSON.stringify(["dating", "social"]),
      style: "chill",
      budgetRange: "$80-$160",
      needs: JSON.stringify(["calendar:read", "weather:read", "maps:read"]),
      description: "Curated date-night ideas with weather fallback and travel buffers.",
      instructions:
        "Focus on Toronto's top date-night neighborhoods: Ossington, King West, Leslieville, and the Distillery District. Prioritize restaurants with good ambiance and moderate pricing ($30-60/person). Always suggest a backup indoor option in case of rain. Factor in 20-minute travel buffers between activities. For summer, include patio options. For winter, prioritize cozy venues with fireplaces or heated patios.",
      tags: JSON.stringify(["date-night", "toronto", "restaurants"]),
      dataSources: JSON.stringify([]),
      installed: false,
    },
    {
      slug: "rainy-day-rescue",
      name: "Rainy Day Rescue",
      city: "Any",
      modes: JSON.stringify(["family", "relax", "social"]),
      style: "predictable",
      budgetRange: "$20-$120",
      needs: JSON.stringify(["weather:read", "calendar:read"]),
      description: "Automatically swaps outdoor plans with strong indoor alternatives.",
      instructions:
        "When weather shows rain or temperatures below 5°C, automatically suggest indoor alternatives. Match the original plan's vibe: if outdoor dining was planned, suggest indoor restaurants with similar cuisine. If a park visit was planned, suggest museums or indoor markets. Always provide at least 2 alternatives ranked by proximity to the original location. Include estimated travel time changes.",
      tags: JSON.stringify(["weather", "backup-plans", "indoor"]),
      dataSources: JSON.stringify([]),
      installed: false,
    },
    {
      slug: "toronto-events-scout",
      name: "Toronto Events Scout",
      city: "Toronto",
      modes: JSON.stringify(["explore", "social", "dating", "family"]),
      style: "curated",
      budgetRange: "$0-$200",
      needs: JSON.stringify(["weather:read"]),
      description:
        "Scans 10+ Toronto event sources to find what's happening in the city right now — festivals, concerts, markets, exhibitions, and community events.",
      instructions:
        "You are an expert Toronto events concierge. When the user asks what's happening in the city, use the fetch_url tool to check the data sources listed below. Prioritize events happening today or this weekend. Group results by category (music, food, arts, sports, community). For each event include: name, date/time, venue, price range if available, and a one-line description. If weather is bad, prioritize indoor events. Always check at least 3-4 sources for a comprehensive picture. Mention the source for each event so the user can get more details.",
      tags: JSON.stringify(["events", "toronto", "festivals", "concerts", "nightlife", "markets"]),
      dataSources: JSON.stringify([
        { url: "https://thelocal.to/", label: "The Local TO", hint: "Toronto local events and happenings" },
        { url: "https://www.toronto.com/", label: "Toronto.com", hint: "City events guide" },
        { url: "https://www.toronto.ca/explore-enjoy/festivals-events/festivals-events-calendar/", label: "City of Toronto", hint: "Official city festivals and events calendar" },
        { url: "https://www.destinationtoronto.com/events/", label: "Destination Toronto", hint: "Tourism board event listings" },
        { url: "https://www.mtccc.com/events/", label: "Metro Toronto Convention Centre", hint: "Convention and expo events" },
        { url: "https://lu.ma/toronto", label: "Luma Toronto", hint: "Tech and community meetups" },
        { url: "https://www.eventbrite.ca/d/canada--toronto/events--today/", label: "Eventbrite Toronto", hint: "Ticketed events happening today" },
        { url: "https://www.sankofasquare.ca/calendar", label: "Sankofa Square", hint: "Cultural and community events" },
        { url: "https://harbourfrontcentre.com/", label: "Harbourfront Centre", hint: "Waterfront arts and culture events" },
        { url: "https://www.scotiabankarena.com/events", label: "Scotiabank Arena", hint: "Major concerts and sports events" },
      ]),
      installed: true,
    },
    {
      slug: "ontario-parks-camping-reservations",
      name: "Ontario Parks Camping Reservations",
      city: "Ontario",
      modes: JSON.stringify(["explore", "family", "relax"]),
      style: "predictable",
      budgetRange: "$30-$220",
      needs: JSON.stringify(["calendar:read", "weather:read", "maps:read"]),
      description:
        "Plans camping trips for Ontario Parks and links users directly to official reservation flow with season-aware recommendations.",
      instructions:
        "You are an Ontario Parks camping planner. When users ask for camping ideas, prioritize Ontario Parks campgrounds by drive distance, family fit, waterfront access, and season suitability. Highlight booking urgency for high-demand weekends and suggest 2-4 options with check-in windows, activity fit, and weather fallback. For each recommendation include a direct reservation path or official park page. Mention if shoulder season conditions may require extra prep (cold nights, early closures, limited services).",
      tags: JSON.stringify(["ontario-parks", "camping", "reservations", "weekend-trips"]),
      dataSources: JSON.stringify([
        {
          url: "https://www.ontarioparks.ca/reservations",
          label: "Ontario Parks Reservations",
          hint: "Official reservation portal for Ontario Parks campsites",
        },
        {
          url: "https://www.ontarioparks.ca/park-locator",
          label: "Ontario Parks Park Locator",
          hint: "Official list of parks with facilities and location details",
        },
      ]),
      installed: false,
    },
    {
      slug: "parks-canada-campgrounds",
      name: "Parks Canada Campgrounds",
      city: "Canada",
      modes: JSON.stringify(["explore", "family", "relax"]),
      style: "curated",
      budgetRange: "$25-$260",
      needs: JSON.stringify(["calendar:read", "weather:read", "maps:read"]),
      description:
        "Finds and plans camping in Canadian national parks with direct Parks Canada reservation links and trip constraints.",
      instructions:
        "You are a Parks Canada campground specialist. For camping requests, prioritize national park campgrounds based on travel distance, trip duration, and user vibe (quiet, scenic, family, adventure). Surface reservation timing risk and suggest alternatives when availability may be tight. Include 2-4 options with practical notes: drive time band, likely demand level, and weather-aware gear considerations. Always include official Parks Canada links for booking and details.",
      tags: JSON.stringify(["parks-canada", "national-parks", "camping", "reservations"]),
      dataSources: JSON.stringify([
        {
          url: "https://reservation.pc.gc.ca/",
          label: "Parks Canada Reservation Service",
          hint: "Official booking portal for Parks Canada campgrounds",
        },
        {
          url: "https://parks.canada.ca/voyage-travel/hebergement-accommodation",
          label: "Parks Canada Accommodation and Camping",
          hint: "Official overview of camping and accommodation types",
        },
      ]),
      installed: false,
    },
    {
      slug: "camping-spots-finder-canada",
      name: "Camping Spots Finder (Canada)",
      city: "Canada",
      modes: JSON.stringify(["explore", "family", "relax", "social"]),
      style: "curated",
      budgetRange: "$0-$280",
      needs: JSON.stringify(["calendar:read", "weather:read", "maps:read"]),
      description:
        "Discovers camping spots across official and community sources, then narrows options by vibe, access, and budget.",
      instructions:
        "You are a camping discovery operator for Canada. Build a short list of camping spots using a mix of official reservation systems and discovery sources. Match results to user constraints (drive radius, budget, tent vs. RV, amenities, pet-friendly). Rank options by fit and include why each one made the list. When availability is uncertain, provide backup spots in nearby regions and call out booking urgency for peak weekends.",
      tags: JSON.stringify(["camping", "campgrounds", "discovery", "canada"]),
      dataSources: JSON.stringify([
        {
          url: "https://www.ontarioparks.ca/reservations",
          label: "Ontario Parks Reservations",
          hint: "Ontario provincial park campsites",
        },
        {
          url: "https://reservation.pc.gc.ca/",
          label: "Parks Canada Reservation Service",
          hint: "National park campgrounds across Canada",
        },
        {
          url: "https://www.hipcamp.com/en-CA",
          label: "Hipcamp Canada",
          hint: "Private land and unique camping spots",
        },
      ]),
      installed: false,
    },
  ];

  const existingPackSlugs = new Set(
    (await db.pack.findMany({ select: { slug: true } })).map((p) => p.slug),
  );
  const missingPacks = seedPacks.filter((p) => !existingPackSlugs.has(p.slug));
  if (missingPacks.length > 0) {
    await db.pack.createMany({ data: missingPacks });
  }

  if ((await db.integrationConnection.count()) === 0) {
    await db.integrationConnection.createMany({
      data: [
        {
          provider: "telegram",
          kind: "channel",
          status: "disconnected",
          displayName: "Telegram",
          grantedScopes: JSON.stringify(["read", "write"]),
        },
        {
          provider: "whatsapp",
          kind: "channel",
          status: "disconnected",
          displayName: "WhatsApp",
          grantedScopes: JSON.stringify(["read", "write"]),
        },
        {
          provider: "google_calendar",
          kind: "calendar",
          status: "disconnected",
          displayName: "Google Calendar",
          grantedScopes: JSON.stringify(["read", "write", "delete"]),
        },
        {
          provider: "weather",
          kind: "context",
          status: "disconnected",
          displayName: "Weather",
          grantedScopes: JSON.stringify(["read"]),
        },
        {
          provider: "opentable",
          kind: "reservation",
          status: "disconnected",
          displayName: "OpenTable",
          grantedScopes: JSON.stringify(["read"]),
        },
      ],
    });
  }

  if ((await db.memoryEntry.count()) === 0) {
    await db.memoryEntry.createMany({
      data: [
        {
          bucket: "taste_memory",
          key: "favorite_activity",
          value: "local events",
          source: "system",
          confidence: 0.4,
          pinned: false,
        },
        {
          bucket: "logistics_memory",
          key: "max_travel_minutes",
          value: "20",
          source: "user_input",
          confidence: 1,
        },
      ],
    });
  }

  if ((await db.approval.count()) === 0) {
    await db.approval.create({
      data: { title: "Reserve 2 tickets", amount: 64, status: "pending" },
    });
  }

  if ((await db.softHold.count()) === 0) {
    const start = new Date(Date.now() + 86400000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    await db.softHold.create({
      data: { title: "Soft hold: Saturday adventure", startAt: start, endAt: end, status: "held" },
    });
  }
}

