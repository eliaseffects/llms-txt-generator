# llms-txt-generator — Development Plan

> CLI + web app that crawls a site or folder and generates both `llms.txt` and `agent.json` optimized for agent discovery and tool use.

---

## A. Vision

### What It Is
A dual-mode tool (CLI + web UI) that ingests a website URL or local docs folder and outputs two standardized files:
- `llms.txt` for agent-friendly summaries of content
- `agent.json` for structured capabilities, endpoints, pricing, and auth hints

### Why It Matters
Agents need fast, predictable discovery. SEO is for humans. This is AEO (Agent Engine Optimization) for the agent economy.

### Design Principles
1. Fast and deterministic output
2. Clear, structured metadata over fluff
3. Safe by default (no secrets pulled)
4. Opinionated defaults, configurable overrides

---

## B. Target User Experience

### Basic Usage
- CLI: `llms-txt https://example.com`
- CLI: `llms-txt ./docs --local`
- Web: paste URL or upload a folder (zip)

### Advanced Usage
- Custom schema fields
- Exclude paths (`/blog`, `/careers`)
- Multi-language output

---

## C. Technology Stack

### Language/Framework
- TypeScript
- CLI: Node.js + Commander
- Web: Next.js (App Router) + Tailwind

### Core Dependencies
- `playwright` or `cheerio` for crawling
- `robots-parser` for respecting crawl rules
- `zod` for schema validation

### Optional Dependencies
- `mdast`/`remark` for markdown normalization

---

## D. Project Structure

```
/
├── apps/
│   ├── cli/
│   └── web/
├── packages/
│   ├── core/            # crawler + generator
│   └── schemas/         # llms.txt + agent.json types
└── docs/
```

---

## E. Command & API Design

### CLI
- `llms-txt <url>`
- `llms-txt <path> --local`
- `--out <dir>`
- `--exclude <glob>`
- `--max-pages <n>`

### Web
- POST `/api/generate` with `{ url | zip }`

---

## F. Feature Breakdown

### Phase 1: MVP
- Crawl URL or local folder
- Generate `llms.txt` + `agent.json`
- Output to local dir and download in web UI

### Phase 2: Polish
- Preset templates (SaaS, API, Docs)
- Live preview
- Scoring: “agent readability” metric

### Phase 3: Advanced
- GitHub Action integration
- Auto-regenerate on deploy

---

## G. Testing Strategy

- Unit: schema validation and transforms
- Integration: known docs site fixtures
- Manual: different site structures

---

## H. Build & Release

- Monorepo with pnpm
- CI: lint + tests
- Releases: npm for CLI, Vercel for web

---

## I. Documentation

- Quick start
- Example outputs
- “Best practices for agent-readable docs”

---

## J. Distribution Channels

- npm package
- Hosted web app
- GitHub Action

---

## K. Implementation Checklist

### Setup
- [ ] Create monorepo structure
- [ ] Initialize CLI + web app
- [ ] Define schemas

### Core
- [ ] Crawler
- [ ] Generator
- [ ] Output writers

### Web
- [ ] Upload/paste flow
- [ ] Download bundle

### Testing
- [ ] Unit + integration

### Release
- [ ] Publish CLI
- [ ] Deploy web

---

## L. Post-Launch

- Registry of “agent-optimized” sites
- Integration with OpenClaw skill registry

---

## M. Success Metrics

- GitHub stars in first 30 days
- # of sites generated
- Weekly active CLI users

---

*Status: Ready for Implementation*
