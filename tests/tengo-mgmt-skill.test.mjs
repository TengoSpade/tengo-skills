import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const skillPath = new URL("../tengo-mgmt/SKILL.md", import.meta.url);
const referencePaths = [
  "../tengo-mgmt/references/codex.md",
  "../tengo-mgmt/references/claude-code.md",
  "../tengo-mgmt/references/gemini.md",
];
const platformSkillPaths = [
  "../codex/tengo-mgmt/SKILL.md",
  "../gemini/tengo-mgmt/SKILL.md",
];

test("SKILL.md exposes the tengo-mgmt portable orchestration skill", async () => {
  const skill = await readFile(skillPath, "utf8");

  assert.match(skill, /^---\nname: tengo-mgmt\n/m);
  assert.match(skill, /description: Use when/m);
  assert.match(skill, /orchestrator agent/i);
  assert.match(skill, /platform-neutral/i);
  assert.match(skill, /\.orchestrator\//);
  assert.match(skill, /model/i);
  assert.match(skill, /reasoning/i);
  assert.match(skill, /approval/i);
  assert.match(skill, /dashboard/i);
  assert.match(skill, /references\/codex\.md/);
  assert.match(skill, /references\/claude-code\.md/);
  assert.match(skill, /references\/gemini\.md/);
});

test("platform references describe capabilities and manual fallback", async () => {
  for (const path of referencePaths) {
    const reference = await readFile(new URL(path, import.meta.url), "utf8");

    assert.match(reference, /agent|subagent|session|thread/i);
    assert.match(reference, /model/i);
    assert.match(reference, /reasoning/i);
    assert.match(reference, /pending|manual/i);
    assert.match(reference, /dashboard/i);
  }
});

test("platform install copies are present", async () => {
  for (const path of platformSkillPaths) {
    const skill = await readFile(new URL(path, import.meta.url), "utf8");

    assert.match(skill, /^---\nname: tengo-mgmt\n/m);
    assert.match(skill, /platform-neutral/i);
  }
});
