import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT ?? 4783);
const projectDir = process.env.TENGO_PROJECT_DIR ?? process.cwd();
const publicDir = new URL("./public/", import.meta.url);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (url.pathname === "/api/state") {
      await sendJson(response, await readState());
      return;
    }
    if (url.pathname === "/api/events") {
      await sendJson(response, { events: await readEvents() });
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
    events: await readEvents(),
  };
}

async function readEvents() {
  const text = await readFile(join(projectDir, ".orchestrator", "events.jsonl"), "utf8").catch(() => "");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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
