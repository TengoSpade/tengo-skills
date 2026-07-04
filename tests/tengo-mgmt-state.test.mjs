import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  ARTIFACT_CATEGORIES,
  STATUS_VALUES,
  createInitialState,
  loadState,
  validateProposedAgent,
  writeState,
} from "../tengo-mgmt/scripts/tengo-mgmt.mjs";

test("createInitialState builds portable project, agent, and workstream state", () => {
  const state = createInitialState({
    project: {
      name: "Apollo",
      goal: "Ship a project orchestration dashboard",
      constraints: ["local first"],
      successCriteria: ["dashboard loads"],
      sourcePlatform: "codex",
      defaultModel: "gpt-5.4",
      defaultReasoningEffort: "medium",
    },
    agents: [
      {
        id: "agent-reviewer",
        displayName: "Reviewer",
        role: "Review implementation",
        workstream: "review",
        model: "gpt-5.5",
        reasoningEffort: "high",
        currentTask: "Review architecture",
        platform: "codex",
        handle: "thread-123",
      },
    ],
    workstreams: [
      {
        id: "review",
        name: "Review",
        purpose: "Catch regressions",
      },
    ],
  });

  assert.deepEqual(STATUS_VALUES, [
    "proposed",
    "queued",
    "running",
    "blocked",
    "waiting",
    "complete",
    "closed",
  ]);
  assert.equal(state.project.name, "Apollo");
  assert.equal(state.project.defaultModelPolicy.model, "gpt-5.4");
  assert.equal(state.project.defaultModelPolicy.reasoningEffort, "medium");
  assert.equal(state.project.sourcePlatform, "codex");
  assert.equal(state.agents[0].id, "agent-reviewer");
  assert.equal(state.agents[0].status, "queued");
  assert.equal(state.agents[0].model, "gpt-5.5");
  assert.equal(state.agents[0].reasoningEffort, "high");
  assert.equal(state.agents[0].platformHandles.codex, "thread-123");
  assert.equal(state.workstreams[0].status, "queued");
  assert.deepEqual(ARTIFACT_CATEGORIES, [
    "codex-agent-instructions",
    "generated-assets",
    "specs-wrapups",
    "review-docs",
    "source-outputs",
    "data-state",
    "references",
  ]);
  assert.match(state.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("validateProposedAgent reports missing required creation fields", () => {
  const result = validateProposedAgent({
    displayName: "Builder",
    role: "Implement dashboard",
    workstream: "build",
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.missing, [
    "responsibility",
    "initialPrompt",
    "expectedOutput",
    "model",
    "reasoningEffort",
    "agentMode",
  ]);
});

test("writeState and loadState round-trip portable .orchestrator files", async () => {
  const projectDir = await mkdtemp(join(tmpdir(), "tengo-mgmt-"));
  try {
    const state = createInitialState({
      project: {
        name: "Round Trip",
        goal: "Persist state",
        sourcePlatform: "gemini",
        defaultModel: "gemini-default",
        defaultReasoningEffort: "medium",
      },
      agents: [
        {
          id: "agent-planner",
          displayName: "Planner",
          role: "Plan work",
          workstream: "discovery",
          model: "gemini-default",
          reasoningEffort: "medium",
          platform: "gemini",
          status: "running",
        },
      ],
      workstreams: [{ id: "discovery", name: "Discovery", purpose: "Understand scope" }],
      artifacts: [
        {
          id: "artifact-spec",
          title: "Gameplay Design Spec",
          category: "specs-wrapups",
          path: "docs/superpowers/specs/gameplay.md",
          owningAgent: "agent-planner",
          workstream: "discovery",
          status: "complete",
          description: "Approved design spec",
        },
      ],
      events: [{ type: "agent.created", agentId: "agent-planner", message: "Planner started" }],
    });

    await writeState(projectDir, state);
    const loaded = await loadState(projectDir);
    const instruction = await readFile(
      join(projectDir, ".orchestrator", "agent-instructions", "agent-planner.md"),
      "utf8",
    );

    assert.equal(loaded.project.name, "Round Trip");
    assert.equal(loaded.agents[0].platform, "gemini");
    assert.equal(loaded.workstreams[0].id, "discovery");
    assert.equal(loaded.artifacts[0].category, "specs-wrapups");
    assert.equal(loaded.artifacts[0].path, "docs/superpowers/specs/gameplay.md");
    assert.ok(
      loaded.artifacts.some(
        (artifact) =>
          artifact.category === "codex-agent-instructions" &&
          artifact.path === ".orchestrator/agent-instructions/agent-planner.md" &&
          artifact.owningAgent === "agent-planner",
      ),
    );
    assert.match(instruction, /# Planner/);
    assert.match(instruction, /Role: Plan work/);
    assert.match(instruction, /Model: gemini-default/);
    assert.match(instruction, /Reasoning Effort: medium/);
    assert.equal(loaded.events[0].type, "agent.created");
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});
