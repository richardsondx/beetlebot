import { describe, expect, it } from "vitest";
import { compileTrigger } from "../../lib/runtime/scheduler";

describe("compileTrigger", () => {
  it("compiles time trigger to cron", () => {
    const compiled = compileTrigger("time", "Friday 12:00");
    expect(compiled.triggerType).toBe("time");
    expect(compiled.cron).toBeTruthy();
  });

  it("compiles context trigger to watcher", () => {
    const compiled = compileTrigger("context", "calendar_gap");
    expect(compiled.watcher).toContain("context:");
  });
});

