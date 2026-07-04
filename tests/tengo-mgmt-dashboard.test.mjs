import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const template = new URL("../tengo-mgmt/assets/dashboard-template/", import.meta.url);

async function readTemplateFile(path) {
  return readFile(new URL(path, template), "utf8");
}

test("dashboard template is dependency-free and startable", async () => {
  const packageJson = JSON.parse(await readTemplateFile("package.json"));
  const server = await readTemplateFile("server.mjs");

  assert.deepEqual(packageJson.dependencies ?? {}, {});
  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.scripts.start, "node server.mjs");
  assert.match(server, /createServer/);
  assert.match(server, /\/api\/state/);
  assert.match(server, /\/api\/events/);
  assert.match(server, /\.orchestrator/);
});

test("dashboard UI contains chat-first workstream and agent management surfaces", async () => {
  const html = await readTemplateFile("public/index.html");
  const js = await readTemplateFile("public/app.js");
  const css = await readTemplateFile("public/styles.css");
  const combined = `${html}\n${js}\n${css}`;

  assert.match(combined, /orchestrator chat/i);
  assert.match(combined, /workstreams/i);
  assert.match(combined, /agents/i);
  assert.match(combined, /create agent/i);
  assert.match(combined, /model/i);
  assert.match(combined, /reasoning/i);
  assert.match(combined, /blocked|pending|manual/i);
  assert.match(combined, /events/i);
});
