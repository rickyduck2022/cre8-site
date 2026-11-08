import { describe, expect, it } from "vitest";
import { typography } from "../../tokens/src/index";
import tokens from "../../tokens/src/tokens.json";

describe("typography tokens", () => {
  it("keeps the JSON and TypeScript APIs in sync and exposes CSS variables", () => {
    expect(tokens.typography).toEqual(typography);
    for (const group of Object.values(typography)) {
      for (const value of Object.values(group)) {
        expect(value).toMatch(/^var\(--(?:font|type)-[\w-]+\)$/);
      }
    }
  });
});
