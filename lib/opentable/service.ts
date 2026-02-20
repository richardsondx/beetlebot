import { getIntegrationConnection } from "@/lib/repositories/integrations";

function parseConfig(configJson?: string | null): Record<string, string> {
  if (!configJson) return {};
  try {
    return JSON.parse(configJson) as Record<string, string>;
  } catch {
    return {};
  }
}

async function getOpenTableConfig() {
  const conn = await getIntegrationConnection("opentable");
  if (conn.status !== "connected") {
    throw new Error("OpenTable integration is not connected.");
  }
  return parseConfig(conn.config ? JSON.stringify(conn.config) : null);
}

export async function searchRestaurants(input: {
  query?: string;
  city?: string;
  partySize?: number;
  date?: string;
  time?: string;
}) {
  const config = await getOpenTableConfig();
  const city = input.city || config.defaultCity || "Toronto";
  const partySize = input.partySize || Number(config.defaultPartySize) || 2;
  const date = input.date || new Date().toISOString().split("T")[0];
  const time = input.time || "19:00";

  const searchTerm = input.query ? `${input.query} ${city}` : city;
  const bookingUrl = `https://www.opentable.com/s?term=${encodeURIComponent(searchTerm)}&covers=${partySize}&dateTime=${date}T${time}`;

  return {
    searchUrl: bookingUrl,
    city,
    partySize,
    date,
    time,
    query: input.query ?? null,
    message:
      `Search OpenTable for restaurants in ${city} for ${partySize} guests on ${date} at ${time}.` +
      (input.query ? ` Query: "${input.query}".` : "") +
      ` Browse results: ${bookingUrl}`,
  };
}

export async function checkAvailability(input: {
  restaurantName: string;
  city?: string;
  partySize?: number;
  date?: string;
  time?: string;
}) {
  const config = await getOpenTableConfig();
  const city = input.city || config.defaultCity || "Toronto";
  const partySize = input.partySize || Number(config.defaultPartySize) || 2;
  const date = input.date || new Date().toISOString().split("T")[0];
  const time = input.time || "19:00";

  const searchTerm = `${input.restaurantName} ${city}`;
  const bookingUrl = `https://www.opentable.com/s?term=${encodeURIComponent(searchTerm)}&covers=${partySize}&dateTime=${date}T${time}`;

  return {
    restaurantName: input.restaurantName,
    bookingUrl,
    city,
    partySize,
    date,
    time,
    message:
      `Check availability for "${input.restaurantName}" in ${city} ` +
      `for ${partySize} guests on ${date} at ${time}. ` +
      `View and book: ${bookingUrl}`,
  };
}

export async function generateBookingLink(input: {
  restaurantName: string;
  city?: string;
  partySize?: number;
  date?: string;
  time?: string;
}) {
  const config = await getOpenTableConfig();
  const city = input.city || config.defaultCity || "Toronto";
  const partySize = input.partySize || Number(config.defaultPartySize) || 2;
  const date = input.date || new Date().toISOString().split("T")[0];
  const time = input.time || "19:00";

  const searchTerm = `${input.restaurantName} ${city}`;
  const bookingUrl = `https://www.opentable.com/s?term=${encodeURIComponent(searchTerm)}&covers=${partySize}&dateTime=${date}T${time}`;

  return {
    restaurantName: input.restaurantName,
    bookingUrl,
    city,
    partySize,
    date,
    time,
    message:
      `Book "${input.restaurantName}" in ${city} for ${partySize} guests ` +
      `on ${date} at ${time}: ${bookingUrl}`,
  };
}
