import { readFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { load } from "cheerio";
import { normalizeWhitespace, titleFromSource } from "./text.js";
import type { DocumentEntry, GenerateOptions } from "./types.js";

function fromHtml(source: string, content: string) {
  const $ = load(content);
  $("script, style, noscript").remove();
  const title = normalizeWhitespace($("title").first().text()) || titleFromSource(source);
  const text = normalizeWhitespace($("body").text());

  return { title, text };
}

export async function readLocalDocs(targetDir: string, options: GenerateOptions = {}): Promise<DocumentEntry[]> {
  const files = await fg(["**/*.{md,mdx,txt,html,htm}"], {
    cwd: targetDir,
    ignore: options.exclude ?? [],
    onlyFiles: true,
    dot: false
  });

  files.sort((a, b) => a.localeCompare(b));

  const docs: DocumentEntry[] = [];

  for (const relativePath of files) {
    const absolutePath = path.join(targetDir, relativePath);

    let content: string;
    try {
      content = await readFile(absolutePath, "utf8");
    } catch {
      continue;
    }

    if (!content.trim()) continue;

    const extension = path.extname(relativePath).toLowerCase();

    if (extension === ".html" || extension === ".htm") {
      const parsed = fromHtml(relativePath, content);
      if (!parsed.text) continue;

      docs.push({
        source: relativePath,
        title: parsed.title,
        text: parsed.text
      });

      continue;
    }

    docs.push({
      source: relativePath,
      title: titleFromSource(relativePath),
      text: normalizeWhitespace(content)
    });
  }

  return docs;
}
