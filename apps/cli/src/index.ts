#!/usr/bin/env node
import path from "node:path";
import { existsSync } from "node:fs";
import { Command } from "commander";
import { generateFromLocal, generateFromUrl, writeOutputs } from "@llms-txt/core";

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const program = new Command();

program
  .name("llms-txt")
  .description("Generate llms.txt and agent.json from a website or local docs folder")
  .argument("<target>", "URL or local folder path")
  .option("--local", "Treat target as a local folder")
  .option("--out <dir>", "Output directory", "./output")
  .option("--exclude <glob...>", "Glob patterns to exclude", [])
  .option("--max-pages <n>", "Maximum pages to crawl for URL mode", (value) => Number.parseInt(value, 10), 20)
  .option("--name <name>", "Override project name in generated output")
  .action(async (target: string, options) => {
    const outputDir = path.resolve(options.out);
    const exclude = Array.isArray(options.exclude) ? options.exclude : [];

    if (options.local) {
      const resolved = path.resolve(target);
      if (!existsSync(resolved)) {
        console.error(`Local path does not exist: ${resolved}`);
        process.exit(1);
      }

      const result = await generateFromLocal(resolved, {
        exclude,
        name: options.name
      });

      const written = await writeOutputs(outputDir, result);
      console.log(`Generated ${written.llmsPath}`);
      console.log(`Generated ${written.agentPath}`);
      return;
    }

    if (!isHttpUrl(target)) {
      console.error("Target must be a URL unless --local is used.");
      process.exit(1);
    }

    const result = await generateFromUrl(target, {
      exclude,
      maxPages: options.maxPages,
      name: options.name
    });

    const written = await writeOutputs(outputDir, result);
    console.log(`Generated ${written.llmsPath}`);
    console.log(`Generated ${written.agentPath}`);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
