"use client";

import { FormEvent, useMemo, useState } from "react";

type Mode = "url" | "zip";

export default function HomePage() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [maxPages, setMaxPages] = useState(20);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const canSubmit = useMemo(() => {
    if (mode === "url") return Boolean(url.trim());
    return zipFile !== null;
  }, [mode, url, zipFile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus("loading");
    setMessage("Generating files...");

    const formData = new FormData();
    formData.set("mode", mode);
    if (name.trim()) formData.set("name", name.trim());

    if (mode === "url") {
      formData.set("url", url.trim());
      formData.set("maxPages", String(maxPages));
    } else if (zipFile) {
      formData.set("zip", zipFile);
    }

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Generation failed");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "llms-txt-output.zip";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      setStatus("success");
      setMessage("Download ready: llms-txt-output.zip");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">AEO Toolkit</p>
        <h1>Generate `llms.txt` + `agent.json` in one pass</h1>
        <p>
          Crawl a docs URL or upload a zipped docs folder. The app produces deterministic discovery files for agent tooling.
        </p>
      </section>

      <section className="panel">
        <div className="mode-toggle" role="tablist" aria-label="Generation mode">
          <button
            type="button"
            className={mode === "url" ? "active" : ""}
            onClick={() => setMode("url")}
            role="tab"
            aria-selected={mode === "url"}
          >
            Website URL
          </button>
          <button
            type="button"
            className={mode === "zip" ? "active" : ""}
            onClick={() => setMode("zip")}
            role="tab"
            aria-selected={mode === "zip"}
          >
            Zip Upload
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <label>
            Project name (optional)
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="acme-docs"
            />
          </label>

          {mode === "url" ? (
            <>
              <label>
                URL
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://docs.example.com"
                  required
                />
              </label>
              <label>
                Max pages
                <input
                  type="number"
                  value={maxPages}
                  min={1}
                  max={200}
                  onChange={(event) => setMaxPages(Number(event.target.value) || 20)}
                />
              </label>
            </>
          ) : (
            <label>
              Docs zip file
              <input
                type="file"
                accept=".zip"
                onChange={(event) => setZipFile(event.target.files?.[0] ?? null)}
                required
              />
            </label>
          )}

          <button type="submit" disabled={!canSubmit || status === "loading"}>
            {status === "loading" ? "Generating..." : "Generate Bundle"}
          </button>

          {message ? <p className={`status ${status}`}>{message}</p> : null}
        </form>
      </section>
    </main>
  );
}
