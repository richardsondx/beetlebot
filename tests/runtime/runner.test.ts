import { describe, expect, it } from "vitest";
import { canExecute } from "../../lib/runtime/runner";

describe("canExecute", () => {
  it("blocks execution when approval is ask_first", () => {
    expect(canExecute("ask_first")).toBe(false);
  });

  it("allows execution for auto rules", () => {
    expect(canExecute("auto_hold")).toBe(true);
    expect(canExecute("auto_execute")).toBe(true);
  });
});

