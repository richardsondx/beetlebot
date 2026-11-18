import { describe, expect, it } from "vitest";
import { enrichLlmReply } from "../../lib/chat/visual-enricher";

const COMPARE_ASK =
  "Plan a 10 day beach trip from Toronto for 2 adults. I am choosing between Bali, the Maldives, and Palawan. Compare them side by side.";

const PROSE_REPLY =
  "If you want easy and variety, Bali wins for 10 days. If you want total " +
  "disconnect and best snorkeling, Maldives. If you want wild lagoon " +
  "stuff, Palawan. Are you two more go-go explorers or park-it types?";

describe("beach previews from a prose reply", () => {
  it(
    "builds three short showcases when the model answers in prose",
    { timeout: 30_000 },
    async () => {
    const msg = await enrichLlmReply(PROSE_REPLY, {
      userMessage: COMPARE_ASK,
    });
    expect(msg.blocks).toHaveLength(3);
    for (const block of msg.blocks!) {
      expect(block.type).toBe("destination_preview");
    }
    const first = msg.blocks![0];
    if (first.type !== "destination_preview") return;
    expect(first.place).toBe("Bali");
    expect(first.countryLine).toBe("Bali, Indonesia");
    const practical = first.sections.find(
      (s) => s.kind === "practical_notes",
    )?.practical;
    expect(practical?.flight).toContain("Sample");
    expect(first.heroPhotoUrl === "" || first.heroPhotoUrl.startsWith("https://")).toBe(true);
    expect(first.heroPhotoUrl).not.toContain("placehold.co");
    // No Pick button, no compare OptionSet anywhere in the reply.
    expect(JSON.stringify(msg.blocks)).not.toMatch(/pick/i);
    expect(JSON.stringify(msg.blocks)).not.toContain("option_set");
    // Closing line and set line sit on the last preview.
    const last = msg.blocks![2];
    if (last.type !== "destination_preview") return;
    expect(last.setLine).toContain("Three places, each its own kind of trip");
    expect(last.closingLine).toContain("When you're ready to go");
    // The model's prose verdict stays as the text above the previews.
    expect(msg.text).toContain("Bali wins for 10 days");
  });

  it("does not inject previews for a plain suggestion ask", async () => {
    const msg = await enrichLlmReply(PROSE_REPLY, {
      userMessage: "suggest a beach destination",
    });
    expect(msg.blocks).toBeUndefined();
  });

  it("does not inject previews when no user message is passed", async () => {
    const msg = await enrichLlmReply(PROSE_REPLY);
    expect(msg.blocks).toBeUndefined();
  });
});
