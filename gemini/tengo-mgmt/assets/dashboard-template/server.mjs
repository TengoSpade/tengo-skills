import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, readdir } from "node:fs/promises";
import { basename, extname, join, normalize } from "node:path";

const port = Number(process.env.PORT ?? 4783);
const projectDir = process.env.TENGO_PROJECT_DIR ?? process.cwd();
const publicDir = new URL("./public/", import.meta.url);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const artifactScanRules = [
  { directory: ".orchestrator", category: "data-state", extensions: [".json", ".jsonl"] },
  { directory: ".agents", category: "codex-agent-instructions", extensions: [".md", ".json"] },
  { directory: ".codex", category: "codex-agent-instructions", extensions: [".md", ".json"] },
  { directory: "agents", category: "codex-agent-instructions", extensions: [".md", ".json"] },
  { directory: "assets", category: "generated-assets", extensions: [".gif", ".jpg", ".jpeg", ".png", ".svg", ".webp"] },
  { directory: "generated", category: "generated-assets", extensions: [".gif", ".jpg", ".jpeg", ".png", ".svg", ".webp"] },
  { directory: "docs", category: "specs-wrapups", extensions: [".md", ".txt"] },
  { directory: "specs", category: "specs-wrapups", extensions: [".md", ".txt"] },
  { directory: "wrap-ups", category: "specs-wrapups", extensions: [".md", ".txt"] },
  { directory: "reviews", category: "review-docs", extensions: [".md", ".txt"] },
  { directory: "reports", category: "review-docs", extensions: [".md", ".txt"] },
  { directory: "src", category: "source-outputs", extensions: [".css", ".html", ".js", ".jsx", ".mjs", ".ts", ".tsx"] },
  { directory: "references", category: "references", extensions: [".md", ".pdf", ".txt"] },
];

const agentStartRoute = /^\/api\/agents\/(?<agentId>[^/]+)\/start$/;
const agentMessageRoute = /^\/api\/agents\/(?<agentId>[^/]+)\/message$/;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    const agentStartMatch = url.pathname.match(agentStartRoute);
    const agentMessageMatch = url.pathname.match(agentMessageRoute);

    if (request.method === "GET" && url.pathname === "/api/state") {
      await sendJson(response, await readState());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/events") {
      await sendJson(response, { events: await readEvents() });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/commands") {
      await sendJson(response, { commands: await readCommands() });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/orchestrator/message") {
      const body = await readRequestJson(request);
      const command = await appendCommand({
        type: "orchestrator.message",
        message: body.message ?? "",
      });
      await sendJson(response, { command });
      return;
    }
    if (request.method === "POST" && agentStartMatch?.groups?.agentId) {
      const command = await appendCommand({
        type: "agent.start",
        agentId: decodeURIComponent(agentStartMatch.groups.agentId),
      });
      await sendJson(response, { command });
      return;
    }
    if (request.method === "POST" && agentMessageMatch?.groups?.agentId) {
      const body = await readRequestJson(request);
      const command = await appendCommand({
        type: "agent.message",
        agentId: decodeURIComponent(agentMessageMatch.groups.agentId),
        message: body.message ?? "",
      });
      await sendJson(response, { command });
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    await sendStatic(response, url.pathname);
  } catch (error) {
    response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Tengo Mgmt dashboard: http://127.0.0.1:${port}`);
  console.log(`Project: ${projectDir}`);
});

async function readState() {
  const stateDir = join(projectDir, ".orchestrator");
  return {
    project: await readJson(join(stateDir, "project.json"), {}),
    agents: await readJson(join(stateDir, "agents.json"), []),
    workstreams: await readJson(join(stateDir, "workstreams.json"), []),
    artifacts: await readArtifacts(stateDir),
    commands: await readCommands(),
    events: await readEvents(),
  };
}

async function readArtifacts(stateDir) {
  const registered = await readJson(join(stateDir, "artifacts.json"), []);
  const scanned = await scanArtifacts();
  const byPath = new Map();
  for (const artifact of scanned) byPath.set(artifact.path, artifact);
  for (const artifact of registered) byPath.set(artifact.path || artifact.id, artifact);
  return [...byPath.values()];
}

async function scanArtifacts() {
  const artifacts = [];
  for (const rule of artifactScanRules) {
    await scanDirectory(join(projectDir, rule.directory), rule.directory, rule, artifacts, 2);
  }
  return artifacts;
}

async function scanDirectory(absDir, relDir, rule, artifacts, depth) {
  if (depth < 0) return;
  const entries = await readdir(absDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const relPath = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!["node_modules", ".git", "dist", "build"].includes(entry.name)) {
        await scanDirectory(join(absDir, entry.name), relPath, rule, artifacts, depth - 1);
      }
      continue;
    }
    if (!entry.isFile() || !rule.extensions.includes(extname(entry.name).toLowerCase())) continue;
    artifacts.push({
      id: relPath.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase(),
      title: titleFromPath(entry.name),
      category: rule.category,
      path: relPath,
      status: "complete",
      description: "",
    });
  }
}

function titleFromPath(path) {
  return basename(path, extname(path)).replace(/[-_]+/g, " ");
}

async function readEvents() {
  const text = await readFile(join(projectDir, ".orchestrator", "events.jsonl"), "utf8").catch(() => "");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function readCommands() {
  const text = await readFile(join(projectDir, ".orchestrator", "commands.jsonl"), "utf8").catch(() => "");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function appendCommand(input) {
  const now = new Date().toISOString();
  const command = {
    id: randomUUID(),
    timestamp: now,
    status: "queued",
    source: "dashboard",
    ...input,
  };
  const stateDir = join(projectDir, ".orchestrator");
  await mkdir(stateDir, { recursive: true });
  await appendFile(join(stateDir, "commands.jsonl"), `${JSON.stringify(command)}\n`, "utf8");
  await appendFile(
    join(stateDir, "events.jsonl"),
    `${JSON.stringify({
      timestamp: now,
      type: "command.queued",
      commandId: command.id,
      agentId: command.agentId,
      message: command.type,
    })}\n`,
    "utf8",
  );
  return command;
}

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function readJson(path, fallback) {
  return JSON.parse(await readFile(path, "utf8").catch(() => JSON.stringify(fallback)));
}

async function sendJson(response, body) {
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

async function sendStatic(response, pathname) {
  const cleanPath = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir.pathname, cleanPath);
  const body = await readFile(filePath);
  response.writeHead(200, { "content-type": contentTypes[extname(filePath)] ?? "text/plain; charset=utf-8" });
  response.end(body);
}
