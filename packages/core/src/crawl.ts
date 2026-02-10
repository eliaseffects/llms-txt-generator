import { load } from "cheerio";
import { minimatch } from "minimatch";
import robotsParser from "robots-parser";
import { normalizeWhitespace, titleFromSource } from "./text.js";
import type { DocumentEntry, GenerateOptions } from "./types.js";

const DEFAULT_MAX_PAGES = 20;
const USER_AGENT = "llms-txt-generator/0.1";

interface RobotsRules {
  isAllowed(url: string, ua?: string): boolean | undefined;
}

const parseRobots = robotsParser as unknown as (url: string, robotstxt: string) => RobotsRules;

function normalizeUrl(raw: string): string {
  const parsed = new URL(raw);
  parsed.hash = "";
  if (parsed.pathname.endsWith("/") && parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.toString();
}

async function fetchRobots(startUrl: URL) {
  const robotsUrl = new URL("/robots.txt", startUrl.origin);

  try {
    const response = await fetch(robotsUrl, {
      headers: { "user-agent": USER_AGENT }
    });

    if (!response.ok) {
      return parseRobots(robotsUrl.toString(), "");
    }

    const robotsTxt = await response.text();
    return parseRobots(robotsUrl.toString(), robotsTxt);
  } catch {
    return parseRobots(robotsUrl.toString(), "");
  }
}

function extractTextAndLinks(html: string, currentUrl: URL) {
  const $ = load(html);
  $("script, style, noscript").remove();

  const title =
    normalizeWhitespace($("title").first().text()) ||
    normalizeWhitespace($("h1").first().text()) ||
    titleFromSource(currentUrl.pathname || currentUrl.href);

  const bodyText = normalizeWhitespace($("body").text());
  const links = new Set<string>();

  $("a[href]").each((_idx, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    try {
      const url = new URL(href, currentUrl);
      if (url.origin !== currentUrl.origin) return;

      if (!/^https?:$/u.test(url.protocol)) return;

      url.hash = "";
      links.add(url.toString());
    } catch {
      // ignore malformed URLs
    }
  });

  return {
    title,
    text: bodyText,
    links: [...links].sort((a, b) => a.localeCompare(b))
  };
}

export async function crawlWebsite(start: string, options: GenerateOptions = {}): Promise<DocumentEntry[]> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const exclude = options.exclude ?? [];

  const root = new URL(start);
  const robots = await fetchRobots(root);

  const queue: string[] = [normalizeUrl(root.toString())];
  const seen = new Set<string>();
  const collected: DocumentEntry[] = [];

  while (queue.length > 0 && collected.length < maxPages) {
    const nextUrl = queue.shift();
    if (!nextUrl || seen.has(nextUrl)) continue;
    seen.add(nextUrl);

    const parsed = new URL(nextUrl);

    if (exclude.some((pattern) => minimatch(parsed.pathname, pattern))) {
      continue;
    }

    if (!robots.isAllowed(nextUrl, USER_AGENT)) {
      continue;
    }

    let response: Response;

    try {
      response = await fetch(nextUrl, {
        headers: { "user-agent": USER_AGENT }
      });
    } catch {
      continue;
    }

    if (!response.ok) continue;

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const text = await response.text();

    if (contentType.includes("text/html")) {
      const parsedHtml = extractTextAndLinks(text, parsed);
      if (parsedHtml.text) {
        collected.push({
          source: nextUrl,
          title: parsedHtml.title,
          text: parsedHtml.text
        });
      }

      for (const link of parsedHtml.links) {
        const normalized = normalizeUrl(link);
        if (!seen.has(normalized)) {
          queue.push(normalized);
        }
      }

      queue.sort((a, b) => a.localeCompare(b));
      continue;
    }

    if (contentType.includes("text/plain") || contentType.includes("text/markdown")) {
      const cleanText = normalizeWhitespace(text);
      if (!cleanText) continue;

      collected.push({
        source: nextUrl,
        title: titleFromSource(parsed.pathname),
        text: cleanText
      });
    }
  }

  return collected.sort((a, b) => a.source.localeCompare(b.source));
}
