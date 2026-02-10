import { describe, expect, it } from "vitest";
import { AgentJsonSchema } from "../src/index.js";

describe("AgentJsonSchema", () => {
  it("validates a minimal object", () => {
    const parsed = AgentJsonSchema.parse({
      name: "Example",
      description: "Example docs",
      sourceType: "url",
      docs: [],
      generatedAt: new Date().toISOString()
    });

    expect(parsed.name).toBe("Example");
    expect(parsed.docs).toEqual([]);
  });
});
