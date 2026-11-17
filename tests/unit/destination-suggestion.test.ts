import { describe, expect, it } from "vitest";
import { enrichLlmReply } from "../../lib/chat/visual-enricher";
import { toPlainText, type ImageCard } from "../../lib/chat/rich-message";
import { sanitiseBlocks } from "../../lib/chat/safety";
import { BEACH_COUNTRY } from "../../lib/travel/beach-compare";
import {
  applyPricePending,
  cardHasPrice,
  correctDestinationCountry,
  DESTINATION_COUNTRY,
  isDestinationSuggestion,
  PRICE_PENDING_LABEL,
  wikiUrlForDestination,
} from "../../lib/travel/destination-suggestion";

function destinationCard(overrides: Partial<ImageCard> = {}): ImageCard {
  return {
    type: "image_card",
    title: "Bali",
    subtitle: "Cliffside villas and quiet surf beaches.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/bali.jpg",
    category: "destination",
    ...overrides,
  };
}

describe("price-pending destination geography", () => {
  it("checks every place label against the geography rule", () => {
    expect(DESTINATION_COUNTRY.Bali).toBe("Indonesia");
    expect(DESTINATION_COUNTRY.Maldives).toBe("Maldives");
    expect(DESTINATION_COUNTRY.Palawan).toBe("Philippines");
    for (const [title, country] of Object.entries(DESTINATION_COUNTRY)) {
      expect(BEACH_COUNTRY[title]).toBe(country);
    }
  });

  it("knows the Wikipedia page for each known destination", () => {
    expect(wikiUrlForDestination("Bali")).toBe(
      "https://en.wikipedia.org/wiki/Bali",
    );
    expect(wikiUrlForDestination("bali")).toBe(
      "https://en.wikipedia.org/wiki/Bali",
    );
    expect(wikiUrlForDestination("Kyoto")).toBeUndefined();
  });
});

describe("applyPricePending", () => {
  it("marks a price-less destination suggestion as price-pending", () => {
    const card = applyPricePending(destinationCard());
    expect(card.pricePending).toBe(true);
    expect(PRICE_PENDING_LABEL).toBe("Price coming soon");
  });

  it("leaves a destination with a price alone", () => {
    const card = applyPricePending(
      destinationCard({ meta: { price: "$420 a night" } }),
    );
    expect(card.pricePending).toBeUndefined();
    expect(
      cardHasPrice(destinationCard({ meta: { price: "$420 a night" } })),
    ).toBe(true);
  });

  it("leaves a compare card with Sample rows alone", () => {
    const card = applyPricePending(
      destinationCard({
        compareRows: [
          { label: "Country", value: "Indonesia" },
          { label: "Hotel", value: "Alila Villas Uluwatu" },
          { label: "Flight", value: "CA$1,240 (Sample)" },
          { label: "Per night", value: "$420 (Sample)" },
        ],
      }),
    );
    expect(card.pricePending).toBeUndefined();
  });

  it("does not mark a price-less restaurant as price-pending", () => {
    const card = applyPricePending(
      destinationCard({
        title: "CIRE",
        subtitle: "Clifftop dining in Uluwatu.",
        category: "restaurant",
      }),
    );
    expect(card.pricePending).toBeUndefined();
    expect(isDestinationSuggestion({ category: "restaurant", title: "CIRE" })).toBe(
      false,
    );
  });

  it("spots a destination by category or by known title", () => {
    expect(
      isDestinationSuggestion({ category: "destination", title: "Kyoto" }),
    ).toBe(true);
    expect(isDestinationSuggestion({ category: "hotel", title: "Bali" })).toBe(
      true,
    );
    expect(
      isDestinationSuggestion({ category: "hotel", title: "Kyoto" }),
    ).toBe(false);
  });
});

describe("correctDestinationCountry", () => {
  it("corrects a bare country label and fills a missing one", () => {
    expect(
      correctDestinationCountry(destinationCard({ subtitle: "Philippines" }))
        .subtitle,
    ).toBe("Indonesia");
    expect(
      correctDestinationCountry(destinationCard({ subtitle: undefined }))
        .subtitle,
    ).toBe("Indonesia");
  });

  it("keeps a one-sentence pitch subtitle as the why-it-fits line", () => {
    const card = correctDestinationCountry(destinationCard());
    expect(card.subtitle).toBe("Cliffside villas and quiet surf beaches.");
  });

  it("corrects a wrong Country compare row", () => {
    const card = correctDestinationCountry(
      destinationCard({
        subtitle: "Indonesia",
        compareRows: [{ label: "Country", value: "Philippines" }],
      }),
    );
    expect(card.compareRows?.[0].value).toBe("Indonesia");
  });

  it("leaves an unknown destination alone", () => {
    const card = correctDestinationCountry(
      destinationCard({ title: "Kyoto", subtitle: "Japan" }),
    );
    expect(card.subtitle).toBe("Japan");
  });
});

describe("price-pending card through the pipeline", () => {
  it("keeps pricePending and drops placehold.co in sanitiseBlocks", () => {
    const safe = sanitiseBlocks([
      {
        type: "image_card",
        title: "Bali",
        subtitle: "Cliffside villas and quiet surf beaches.",
        imageUrl: "https://placehold.co/600x360/0d1826/4a7fbd?text=Bali",
        category: "destination",
        pricePending: true,
      },
    ]);
    expect(safe).toHaveLength(1);
    const card = safe[0];
    expect(card.type).toBe("image_card");
    if (card.type === "image_card") {
      expect(card.imageUrl).toBe("");
      expect(card.pricePending).toBe(true);
    }
  });

  it("prints the pending state in the plain-text fallback", () => {
    const text = toPlainText({
      text: "One beach fits your trip.",
      blocks: [applyPricePending(destinationCard())],
    });
    expect(text).toContain("Price: Price coming soon");
    expect(text).toContain("Cliffside villas and quiet surf beaches.");
  });

  it("enriches a price-less destination suggestion into a photo-first card", async () => {
    const msg = await enrichLlmReply(
      JSON.stringify({
        text: "One new idea for your February trip.",
        options: [
          {
            title: "Bali",
            subtitle: "Cliffside villas and quiet surf beaches.",
            category: "destination",
          },
        ],
      }),
    );
    expect(msg.blocks).toHaveLength(1);
    const block = msg.blocks![0];
    expect(block.type).toBe("image_card");
    if (block.type !== "image_card") return;
    // Photo-first: a real resolved photo, or an empty URL that renders
    // the named fallback icon. Never a placehold.co image.
    expect(block.imageUrl).not.toContain("placehold.co");
    expect(block.imageUrl === "" || block.imageUrl.startsWith("https://")).toBe(
      true,
    );
    // Price-pending: the flag is set, the pitch line is kept, no price
    // is invented and no price area is left blank.
    expect(block.pricePending).toBe(true);
    expect(block.subtitle).toBe("Cliffside villas and quiet surf beaches.");
    expect(block.meta?.price).toBeUndefined();
    const text = toPlainText(msg);
    expect(text).toContain("Price: Price coming soon");
  });
});

describe("price-pending and flight-time meta", () => {
  it("knows the Wikipedia page for a country-suffixed title", () => {
    expect(wikiUrlForDestination("Bali, Indonesia")).toBe(
      "https://en.wikipedia.org/wiki/Bali",
    );
    expect(wikiUrlForDestination("Palawan, Philippines")).toBe(
      "https://en.wikipedia.org/wiki/Palawan",
    );
  });

  it("does not count a flight time as a price", () => {
    expect(
      cardHasPrice(destinationCard({ meta: { flight: "~4.5h from YYZ" } })),
    ).toBe(false);
    expect(
      cardHasPrice(
        destinationCard({ meta: { "flight time": "~22-26h each way" } }),
      ),
    ).toBe(false);
  });

  it("marks a destination with only a flight time as price-pending", () => {
    const card = applyPricePending(
      destinationCard({ meta: { flight: "~4.5h from YYZ" } }),
    );
    expect(card.pricePending).toBe(true);
  });

  it("still counts a money value as a price", () => {
    expect(
      cardHasPrice(
        destinationCard({
          compareRows: [{ label: "Flight", value: "CA$1,240 (Sample)" }],
        }),
      ),
    ).toBe(true);
  });
});
