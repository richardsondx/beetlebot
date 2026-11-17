import { describe, expect, it } from "vitest";
import { enrichLlmReply } from "../../lib/chat/visual-enricher";

const COMPARE_ASK =
  "Plan a 10 day beach trip from Toronto for 2 adults. I am choosing between Bali, the Maldives, and Palawan. Compare them side by side.";

const PROSE_REPLY =
  "If you want easy and variety, Bali wins for 10 days. If you want total " +
  "disconnect and best snorkeling, Maldives. If you want wild lagoon " +
  "stuff, Palawan. Are you two more go-go explorers or park-it types?";

describe("beach compare from a prose reply", () => {
  it("builds the visual compare when the model answers in prose", async () => {
    const msg = await enrichLlmReply(PROSE_REPLY, {
      userMessage: COMPARE_ASK,
    });
    expect(msg.blocks).toHaveLength(1);
    const block = msg.blocks![0];
    expect(block.type).toBe("option_set");
    if (block.type !== "option_set") return;
    expect(block.variant).toBe("compare");
    expect(block.items).toHaveLength(3);
    const first = block.items[0].card;
    expect(first.title).toBe("Bali");
    expect(
      first.compareRows?.find((r) => r.label === "Hotel")?.value,
    ).toBe("Alila Villas Uluwatu");
    expect(
      first.compareRows?.find((r) => r.label === "Flight")?.value,
    ).toContain("Sample");
    expect(first.imageUrl).not.toContain("placehold.co");
    expect(
      first.imageUrl === "" || first.imageUrl.startsWith("https://"),
    ).toBe(true);
    // The model's prose verdict stays as the text above the cards.
    expect(msg.text).toContain("Bali wins for 10 days");
  });

  it("does not inject a compare for a plain suggestion ask", async () => {
    const msg = await enrichLlmReply(PROSE_REPLY, {
      userMessage: "suggest a beach destination",
    });
    expect(msg.blocks).toBeUndefined();
  });

  it("does not inject a compare when no user message is passed", async () => {
    const msg = await enrichLlmReply(PROSE_REPLY);
    expect(msg.blocks).toBeUndefined();
  });
});
