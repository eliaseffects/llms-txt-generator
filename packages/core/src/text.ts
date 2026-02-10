const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "you",
  "are",
  "our",
  "their",
  "will",
  "can",
  "has",
  "have",
  "how",
  "what",
  "when",
  "where",
  "about",
  "using",
  "use",
  "more"
]);

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function summarizeText(text: string, maxLength = 220): string {
  const clean = normalizeWhitespace(text);
  if (!clean) return "No content extracted.";

  const sentences = clean.split(/(?<=[.!?])\s+/u).filter(Boolean);
  const joined = sentences.slice(0, 2).join(" ");
  const candidate = joined || clean;

  return candidate.length <= maxLength ? candidate : `${candidate.slice(0, maxLength - 1)}…`;
}

export function topKeywords(text: string, count = 6): string[] {
  const clean = normalizeWhitespace(text).toLowerCase();
  if (!clean) return [];

  const tokens = clean.match(/[a-z][a-z0-9-]{2,}/g) ?? [];
  const frequency = new Map<string, number>();

  for (const token of tokens) {
    if (STOP_WORDS.has(token)) continue;
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([word]) => word);
}

export function titleFromSource(source: string): string {
  const leaf = source.split("/").filter(Boolean).at(-1);
  if (!leaf) return "Home";

  const withoutExt = leaf.replace(/\.[a-z0-9]+$/i, "");
  if (!withoutExt) return "Document";

  return withoutExt
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}
