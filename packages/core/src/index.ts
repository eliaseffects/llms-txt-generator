import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { crawlWebsite } from "./crawl.js";
import { generateArtifacts } from "./generator.js";
import { readLocalDocs } from "./local.js";
import type { DocumentEntry, GenerateOptions, GenerateResult, SourceType } from "./types.js";

export type { DocumentEntry, GenerateOptions, GenerateResult, SourceType } from "./types.js";

export async function generateFromUrl(url: string, options: GenerateOptions = {}): Promise<GenerateResult> {
  const entries = await crawlWebsite(url, options);
  return generateArtifacts(entries, "url", options, url);
}

export async function generateFromLocal(targetDir: string, options: GenerateOptions = {}): Promise<GenerateResult> {
  const entries = await readLocalDocs(targetDir, options);
  return generateArtifacts(entries, "local", options);
}

export function generateFromEntries(
  entries: DocumentEntry[],
  sourceType: SourceType = "mixed",
  options: GenerateOptions = {},
  homepage?: string
): GenerateResult {
  return generateArtifacts(entries, sourceType, options, homepage);
}

export async function writeOutputs(outputDir: string, result: GenerateResult) {
  await mkdir(outputDir, { recursive: true });

  const llmsPath = path.join(outputDir, "llms.txt");
  const agentPath = path.join(outputDir, "agent.json");

  await Promise.all([
    writeFile(llmsPath, result.llmsTxt, "utf8"),
    writeFile(agentPath, `${JSON.stringify(result.agentJson, null, 2)}\n`, "utf8")
  ]);

  return {
    llmsPath,
    agentPath
  };
}
