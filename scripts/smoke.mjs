#!/usr/bin/env node
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

function logStep(message) {
  console.log(`\n==> ${message}`);
}

function runCommand(command, args, cwd = repoRoot) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env
    });

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });
  });
}

async function waitForHttp(url, timeoutMs = 45000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store"
      });

      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // retry
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function assertFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Expected file was not generated: ${filePath}`);
  }
}

function assertAgentJson(filePath) {
  const content = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(content);

  if (!parsed.name || !Array.isArray(parsed.docs)) {
    throw new Error(`Invalid agent.json schema in ${filePath}`);
  }
}

function createFixtureSite() {
  const fixtureServer = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (url.pathname === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("User-agent: *\nAllow: /\n");
      return;
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
<html>
  <head><title>Fixture Docs Home</title></head>
  <body>
    <h1>Fixture API Docs</h1>
    <p>Use API key authentication for all requests.</p>
    <p>GET /v1/models</p>
    <a href="/auth.html">Auth docs</a>
  </body>
</html>`);
      return;
    }

    if (url.pathname === "/auth.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(`<!doctype html>
<html>
  <head><title>Authentication</title></head>
  <body>
    <h1>Auth</h1>
    <p>POST /v1/chat/completions requires an API key.</p>
  </body>
</html>`);
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });

  return fixtureServer;
}

async function main() {
  const requireFromWeb = createRequire(join(repoRoot, "apps/web/package.json"));
  const JSZip = requireFromWeb("jszip");
  const skipQuality = process.env.SMOKE_SKIP_QUALITY === "1";

  const tempRoot = mkdtempSync(join(tmpdir(), "llms-txt-smoke-"));
  const localDocsDir = join(tempRoot, "local-docs");
  const cliUrlOutDir = join(tempRoot, "cli-url-out");
  const cliLocalOutDir = join(tempRoot, "cli-local-out");

  mkdirSync(localDocsDir, { recursive: true });
  writeFileSync(
    join(localDocsDir, "intro.md"),
    "# Intro\nUse API key authentication.\nGET /v1/models\nPOST /v1/chat/completions\n",
    "utf8"
  );

  const fixtureServer = createFixtureSite();
  await new Promise((resolvePromise, rejectPromise) => {
    fixtureServer.once("error", rejectPromise);
    fixtureServer.listen(0, "127.0.0.1", () => resolvePromise());
  });

  const fixtureAddress = fixtureServer.address();
  if (!fixtureAddress || typeof fixtureAddress === "string") {
    throw new Error("Failed to resolve fixture server address.");
  }

  const fixtureOrigin = `http://127.0.0.1:${fixtureAddress.port}`;

  let webProcess;
  let webProcessExitPromise;

  try {
    if (!skipQuality) {
      logStep("Installing dependencies");
      await runCommand("pnpm", ["install"]);

      logStep("Building workspace");
      await runCommand("pnpm", ["build"]);

      logStep("Running tests");
      await runCommand("pnpm", ["test"]);

      logStep("Running lint checks");
      await runCommand("pnpm", ["lint"]);
    } else {
      logStep("Skipping install/build/test/lint (SMOKE_SKIP_QUALITY=1)");
    }

    logStep("Running CLI smoke (URL mode)");
    await runCommand("pnpm", [
      "--filter",
      "llms-txt-cli",
      "exec",
      "node",
      "dist/index.js",
      `${fixtureOrigin}/index.html`,
      "--out",
      cliUrlOutDir,
      "--max-pages",
      "5",
      "--name",
      "smoke-url"
    ]);

    assertFile(join(cliUrlOutDir, "llms.txt"));
    assertFile(join(cliUrlOutDir, "agent.json"));
    assertAgentJson(join(cliUrlOutDir, "agent.json"));

    logStep("Running CLI smoke (local mode)");
    await runCommand("pnpm", [
      "--filter",
      "llms-txt-cli",
      "exec",
      "node",
      "dist/index.js",
      localDocsDir,
      "--local",
      "--out",
      cliLocalOutDir,
      "--name",
      "smoke-local"
    ]);

    assertFile(join(cliLocalOutDir, "llms.txt"));
    assertFile(join(cliLocalOutDir, "agent.json"));
    assertAgentJson(join(cliLocalOutDir, "agent.json"));

    logStep("Starting web app for API smoke tests");
    const webPort = 3211;
    webProcess = spawn("pnpm", ["--filter", "llms-txt-web", "start", "-p", String(webPort)], {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env
    });

    webProcessExitPromise = new Promise((resolvePromise) => {
      webProcess.once("exit", () => resolvePromise());
    });

    webProcess.on("exit", (code) => {
      if (code !== null && code !== 0) {
        console.error(`llms-txt-web exited early with code ${code}`);
      }
    });

    const webOrigin = `http://127.0.0.1:${webPort}`;
    await waitForHttp(webOrigin);

    logStep("Running web API smoke (URL mode)");
    const urlForm = new FormData();
    urlForm.set("mode", "url");
    urlForm.set("url", `${fixtureOrigin}/index.html`);
    urlForm.set("maxPages", "5");
    urlForm.set("name", "web-smoke-url");

    const urlResponse = await fetch(`${webOrigin}/api/generate`, {
      method: "POST",
      body: urlForm
    });

    if (!urlResponse.ok) {
      throw new Error(`Web URL smoke failed (${urlResponse.status}): ${await urlResponse.text()}`);
    }

    const urlBundle = await JSZip.loadAsync(await urlResponse.arrayBuffer());
    if (!urlBundle.file("llms.txt") || !urlBundle.file("agent.json")) {
      throw new Error("Web URL smoke output zip is missing llms.txt or agent.json");
    }

    logStep("Running web API smoke (ZIP mode)");
    const inputZip = new JSZip();
    inputZip.file("docs/intro.md", "# Intro\nGET /v1/models\nUse API key authentication\n");
    inputZip.file("docs/auth.md", "# Auth\nPOST /v1/chat/completions\n");

    const zipPayload = await inputZip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

    const zipForm = new FormData();
    zipForm.set("mode", "zip");
    zipForm.set("name", "web-smoke-zip");
    zipForm.set("zip", new File([zipPayload], "docs.zip", { type: "application/zip" }));

    const zipResponse = await fetch(`${webOrigin}/api/generate`, {
      method: "POST",
      body: zipForm
    });

    if (!zipResponse.ok) {
      throw new Error(`Web ZIP smoke failed (${zipResponse.status}): ${await zipResponse.text()}`);
    }

    const zipBundle = await JSZip.loadAsync(await zipResponse.arrayBuffer());
    if (!zipBundle.file("llms.txt") || !zipBundle.file("agent.json")) {
      throw new Error("Web ZIP smoke output zip is missing llms.txt or agent.json");
    }

    const zipAgentRaw = await zipBundle.file("agent.json")?.async("string");
    if (!zipAgentRaw) {
      throw new Error("Unable to read agent.json from ZIP-mode output.");
    }

    JSON.parse(zipAgentRaw);

    logStep("Smoke suite passed");
  } finally {
    fixtureServer.close();

    if (webProcess && webProcess.exitCode === null) {
      webProcess.kill("SIGTERM");
      await Promise.race([
        webProcessExitPromise ?? Promise.resolve(),
        new Promise((resolvePromise) => setTimeout(resolvePromise, 1500))
      ]);
      if (webProcess.exitCode === null) {
        webProcess.kill("SIGKILL");
      }
    }

    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("\nSmoke suite failed:");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
