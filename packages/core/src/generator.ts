import { AgentJsonSchema, type AgentJson, type PageSummary } from "@llms-txt/schemas";
import { summarizeText, titleFromSource, topKeywords } from "./text.js";
import type { DocumentEntry, GenerateOptions, SourceType } from "./types.js";

function sourceName(source: string, sourceType: SourceType): string {
  if (sourceType === "url") {
    const url = new URL(source);
    return url.hostname.replace(/^www\./, "");
  }

  return source.split("/")[0] || "local-docs";
}

function inferCapabilities(entries: DocumentEntry[]) {
  const blob = entries.map((entry) => entry.text.toLowerCase()).join("\n");
  const capabilities = [] as AgentJson["capabilities"];

  if (/(\bapi\b|endpoint|http)/u.test(blob)) {
    capabilities.push({
      name: "API Discovery",
      description: "Contains API-oriented documentation and endpoint references."
    });
  }

  if (/(sdk|typescript|python|java|go)/u.test(blob)) {
    capabilities.push({
      name: "SDK Guidance",
      description: "Includes implementation details for one or more SDKs."
    });
  }

  if (/(auth|oauth|token|api key|authentication)/u.test(blob)) {
    capabilities.push({
      name: "Authentication Guidance",
      description: "Provides authentication and credential setup information."
    });
  }

  return capabilities;
}

function inferEndpoints(entries: DocumentEntry[]): AgentJson["endpoints"] {
  const endpointRegex = /\b(GET|POST|PUT|PATCH|DELETE)\s+((?:https?:\/\/[^\s]+|\/[a-z0-9_\-\/.{}]+))/giu;
  const fallbackPathRegex = /(\/[a-z0-9_\-]+(?:\/[a-z0-9_\-{}]+){1,})/giu;

  const unique = new Map<string, AgentJson["endpoints"][number]>();

  for (const entry of entries) {
    for (const match of entry.text.matchAll(endpointRegex)) {
      const method = (match[1] ?? "GET").toUpperCase() as AgentJson["endpoints"][number]["method"];
      const path = match[2] ?? "";
      if (!path) continue;

      const key = `${method}:${path}`;
      if (!unique.has(key)) {
        unique.set(key, {
          method,
          path,
          auth: /auth|token|key/i.test(entry.text) ? "api_key" : "unknown",
          description: `Observed in ${entry.title ?? titleFromSource(entry.source)}`
        });
      }
    }

    if (unique.size > 20) break;
  }

  if (unique.size === 0) {
    for (const entry of entries) {
      for (const match of entry.text.matchAll(fallbackPathRegex)) {
        const path = match[1] ?? "";
        if (!path) continue;

        const key = `GET:${path}`;
        if (!unique.has(key)) {
          unique.set(key, {
            method: "GET",
            path,
            auth: "unknown",
            description: `Possible endpoint path from ${entry.title ?? titleFromSource(entry.source)}`
          });
        }
      }

      if (unique.size > 20) break;
    }
  }

  return [...unique.values()].slice(0, 20);
}

function toPageSummary(entry: DocumentEntry): PageSummary {
  return {
    source: entry.source,
    title: entry.title?.trim() || titleFromSource(entry.source),
    summary: summarizeText(entry.text),
    keywords: topKeywords(entry.text)
  };
}

function toDescription(pages: PageSummary[], sourceType: SourceType): string {
  if (pages.length === 0) {
    return "No parseable documentation content was found.";
  }

  const topWords = new Set<string>();
  for (const page of pages.slice(0, 5)) {
    for (const keyword of page.keywords.slice(0, 2)) {
      topWords.add(keyword);
    }
  }

  const descriptors = [...topWords].slice(0, 5).join(", ");
  const sourceHint =
    sourceType === "url"
      ? "from crawled website pages"
      : sourceType === "local"
        ? "from local documentation files"
        : "from mixed documentation sources";

  return descriptors
    ? `Generated ${sourceHint}. Key topics: ${descriptors}.`
    : `Generated ${sourceHint}.`;
}

export function generateArtifacts(
  entries: DocumentEntry[],
  sourceType: SourceType,
  options: GenerateOptions = {},
  homepage?: string
): { llmsTxt: string; agentJson: AgentJson } {
  const pages = entries.map(toPageSummary);

  const sortedPages = pages.sort((a, b) => a.source.localeCompare(b.source));

  const name =
    options.name ||
    (sourceType === "url" && homepage ? sourceName(homepage, "url") : "local-docs");

  const description = toDescription(sortedPages, sourceType);
  const capabilities = inferCapabilities(entries);
  const endpoints = inferEndpoints(entries);

  const agentJson = AgentJsonSchema.parse({
    name,
    description,
    sourceType,
    homepage,
    docs: sortedPages,
    capabilities,
    endpoints,
    pricing: /pricing|plan|billing/i.test(entries.map((entry) => entry.text).join("\n"))
      ? "See source docs for current plan details."
      : undefined,
    auth: /oauth|api key|token|authentication/i.test(entries.map((entry) => entry.text).join("\n"))
      ? "Authentication appears to be required for some operations."
      : "No explicit authentication details detected.",
    generatedAt: new Date().toISOString(),
    metadata: options.metadata ?? {}
  });

  const llmsLines: string[] = [
    `# ${agentJson.name}`,
    "",
    `> ${agentJson.description}`,
    "",
    `Generated: ${agentJson.generatedAt}`,
    `Source type: ${agentJson.sourceType}`
  ];

  if (homepage) {
    llmsLines.push(`Homepage: ${homepage}`);
  }

  llmsLines.push("", "## Pages");

  if (agentJson.docs.length === 0) {
    llmsLines.push("- No documentation pages were extracted.");
  } else {
    for (const page of agentJson.docs) {
      llmsLines.push(`- ${page.title} (${page.source})`);
      llmsLines.push(`  ${page.summary}`);
      if (page.keywords.length > 0) {
        llmsLines.push(`  Keywords: ${page.keywords.join(", ")}`);
      }
    }
  }

  llmsLines.push("", "## Capabilities");

  if (agentJson.capabilities.length === 0) {
    llmsLines.push("- No explicit capabilities inferred.");
  } else {
    for (const capability of agentJson.capabilities) {
      llmsLines.push(`- ${capability.name}: ${capability.description ?? ""}`.trim());
    }
  }

  llmsLines.push("", "## Endpoints");

  if (agentJson.endpoints.length === 0) {
    llmsLines.push("- No endpoint patterns inferred.");
  } else {
    for (const endpoint of agentJson.endpoints) {
      llmsLines.push(`- ${endpoint.method} ${endpoint.path} (auth: ${endpoint.auth})`);
    }
  }

  return {
    llmsTxt: llmsLines.join("\n") + "\n",
    agentJson
  };
}
