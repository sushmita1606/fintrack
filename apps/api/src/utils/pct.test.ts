import { describe, expect, it } from "vitest";
import { pctChange } from "./pct.js";

describe("pctChange", () => {
  it("returns null when prev is zero and curr non-zero", () => {
    expect(pctChange(0, 100)).toBeNull();
  });
  it("returns percent change rounded to 1 decimal", () => {
    expect(pctChange(100, 125)).toBe(25);
  });
});
