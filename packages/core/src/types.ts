import type { AgentJson } from "@llms-txt/schemas";

export type SourceType = "url" | "local" | "mixed";

export interface GenerateOptions {
  exclude?: string[];
  maxPages?: number;
  name?: string;
  metadata?: Record<string, string>;
}

export interface DocumentEntry {
  source: string;
  text: string;
  title?: string;
}

export interface GenerateResult {
  llmsTxt: string;
  agentJson: AgentJson;
}
