import path from "node:path";
import JSZip from "jszip";
import { generateFromEntries, generateFromUrl, type DocumentEntry } from "@llms-txt/core";

export const runtime = "nodejs";

const ALLOWED_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".html", ".htm"]);

function titleFromPath(entryPath: string): string {
  const fileName = path.basename(entryPath, path.extname(entryPath));
  if (!fileName) return "Document";

  return fileName
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function POST(request: Request) {
  const body = await request.formData();
  const mode = String(body.get("mode") ?? "").trim();
  const name = String(body.get("name") ?? "").trim() || undefined;

  try {
    let llmsTxt: string;
    let agentJson: object;

    if (mode === "url") {
      const url = String(body.get("url") ?? "").trim();
      const maxPages = Number.parseInt(String(body.get("maxPages") ?? "20"), 10);

      if (!url) {
        return Response.json({ error: "URL is required" }, { status: 400 });
      }

      const generated = await generateFromUrl(url, {
        maxPages: Number.isFinite(maxPages) ? maxPages : 20,
        name
      });

      llmsTxt = generated.llmsTxt;
      agentJson = generated.agentJson;
    } else if (mode === "zip") {
      const uploaded = body.get("zip");
      if (!(uploaded instanceof File)) {
        return Response.json({ error: "Zip upload is required" }, { status: 400 });
      }

      const archive = await JSZip.loadAsync(await uploaded.arrayBuffer());
      const entries: DocumentEntry[] = [];

      for (const [entryPath, file] of Object.entries(archive.files)) {
        if (file.dir) continue;

        const extension = path.extname(entryPath).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(extension)) continue;

        const raw = await file.async("string");
        if (!raw.trim()) continue;

        entries.push({
          source: entryPath,
          title: titleFromPath(entryPath),
          text: raw
        });
      }

      const generated = generateFromEntries(entries, "local", { name });
      llmsTxt = generated.llmsTxt;
      agentJson = generated.agentJson;
    } else {
      return Response.json({ error: "Unsupported mode" }, { status: 400 });
    }

    const bundle = new JSZip();
    bundle.file("llms.txt", llmsTxt);
    bundle.file("agent.json", `${JSON.stringify(agentJson, null, 2)}\n`);

    const payload = await bundle.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });

    return new Response(payload, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": "attachment; filename=llms-txt-output.zip",
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unexpected generation error"
      },
      { status: 500 }
    );
  }
}
