import { describe, expect, it } from "vitest";
import { generateFromEntries } from "../src/index.js";

describe("generateFromEntries", () => {
  it("creates deterministic outputs", () => {
    const first = generateFromEntries(
      [
        {
          source: "docs/auth.md",
          text: "Use API key authentication. POST /v1/chat/completions",
          title: "Auth"
        },
        {
          source: "docs/intro.md",
          text: "Welcome to the API docs. GET /v1/models",
          title: "Intro"
        }
      ],
      "local",
      { name: "sample" }
    );

    const second = generateFromEntries(
      [
        {
          source: "docs/auth.md",
          text: "Use API key authentication. POST /v1/chat/completions",
          title: "Auth"
        },
        {
          source: "docs/intro.md",
          text: "Welcome to the API docs. GET /v1/models",
          title: "Intro"
        }
      ],
      "local",
      { name: "sample" }
    );

    expect(first.agentJson.name).toBe("sample");
    expect(first.agentJson.docs.map((page) => page.source)).toEqual([
      "docs/auth.md",
      "docs/intro.md"
    ]);
    expect(first.llmsTxt.includes("POST /v1/chat/completions")).toBe(true);
    expect(second.agentJson.docs[0]?.source).toBe(first.agentJson.docs[0]?.source);
  });
});
