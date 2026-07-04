import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const STATUS_VALUES = [
  "proposed",
  "queued",
  "running",
  "blocked",
  "waiting",
  "complete",
  "closed",
];

export const ARTIFACT_CATEGORIES = [
  "codex-agent-instructions",
  "generated-assets",
  "specs-wrapups",
  "review-docs",
  "source-outputs",
  "data-state",
  "references",
];

const REQUIRED_AGENT_FIELDS = [
  "displayName",
  "role",
  "workstream",
  "responsibility",
  "initialPrompt",
  "expectedOutput",
  "model",
  "reasoningEffort",
  "agentMode",
];

const STATE_DIR = ".orchestrator";

export function createInitialState(input = {}) {
  const now = new Date().toISOString();
  const project = input.project ?? {};
  const defaultModel = project.defaultModel ?? "platform-default";
  const defaultReasoningEffort = project.defaultReasoningEffort ?? "medium";

  return {
    schemaVersion: 1,
    createdAt: now,
    project: {
      name: project.name ?? "Untitled Project",
      goal: project.goal ?? "",
      constraints: project.constraints ?? [],
      successCriteria: project.successCriteria ?? [],
      sourcePlatform: project.sourcePlatform ?? "unknown",
      defaultModelPolicy: {
        model: defaultModel,
        reasoningEffort: defaultReasoningEffort,
      },
      createdAt: project.createdAt ?? now,
    },
    agents: (input.agents ?? []).map((agent) =>
      normalizeAgent(agent, defaultModel, defaultReasoningEffort),
    ),
    workstreams: (input.workstreams ?? []).map(normalizeWorkstream),
    artifacts: (input.artifacts ?? []).map((artifact) => normalizeArtifact(artifact, now)),
    events: (input.events ?? []).map((event) => ({
      timestamp: event.timestamp ?? now,
      ...event,
    })),
  };
}

export function validateProposedAgent(agent = {}) {
  const missing = REQUIRED_AGENT_FIELDS.filter((field) => !agent[field]);
  return {
    valid: missing.length === 0,
    missing,
  };
}

export async function writeState(projectDir, state) {
  const orchestratorDir = join(projectDir, STATE_DIR);
  await mkdir(orchestratorDir, { recursive: true });
  await writeJson(join(orchestratorDir, "project.json"), state.project);
  await writeJson(join(orchestratorDir, "agents.json"), state.agents);
  await writeJson(join(orchestratorDir, "workstreams.json"), state.workstreams);
  const instructionArtifacts = await writeAgentInstructions(orchestratorDir, state.agents ?? []);
  await writeJson(
    join(orchestratorDir, "artifacts.json"),
    mergeArtifacts(state.artifacts ?? [], instructionArtifacts),
  );
  const events = (state.events ?? []).map((event) => JSON.stringify(event)).join("\n");
  await writeFile(join(orchestratorDir, "events.jsonl"), events ? `${events}\n` : "", "utf8");
}

export async function loadState(projectDir) {
  const orchestratorDir = join(projectDir, STATE_DIR);
  const eventsText = await readFile(join(orchestratorDir, "events.jsonl"), "utf8").catch(() => "");
  return {
    project: await readJson(join(orchestratorDir, "project.json")),
    agents: await readJson(join(orchestratorDir, "agents.json")),
    workstreams: await readJson(join(orchestratorDir, "workstreams.json")),
    artifacts: await readJson(join(orchestratorDir, "artifacts.json")).catch(() => []),
    events: eventsText
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
  };
}

function normalizeAgent(agent, defaultModel, defaultReasoningEffort) {
  const platform = agent.platform ?? "manual";
  const handle = agent.handle ?? agent.threadId ?? agent.sessionId ?? agent.subagentId;
  return {
    id: agent.id,
    displayName: agent.displayName,
    role: agent.role,
    workstream: agent.workstream,
    responsibility: agent.responsibility ?? "",
    currentTask: agent.currentTask ?? "",
    initialPrompt: agent.initialPrompt ?? "",
    expectedOutput: agent.expectedOutput ?? "",
    model: agent.model ?? defaultModel,
    reasoningEffort: agent.reasoningEffort ?? defaultReasoningEffort,
    status: normalizeStatus(agent.status ?? "queued"),
    platform,
    agentMode: agent.agentMode ?? "manual",
    platformHandles: handle ? { [platform]: handle } : {},
    blockers: agent.blockers ?? [],
    boundaries: agent.boundaries ?? [],
    lastUpdate: agent.lastUpdate ?? new Date().toISOString(),
  };
}

async function writeAgentInstructions(orchestratorDir, agents) {
  const instructionsDir = join(orchestratorDir, "agent-instructions");
  await mkdir(instructionsDir, { recursive: true });
  const artifacts = [];

  for (const agent of agents) {
    const agentId = agent.id ?? slugify(agent.displayName ?? "agent");
    const relativePath = `${STATE_DIR}/agent-instructions/${agentId}.md`;
    await writeFile(join(instructionsDir, `${agentId}.md`), renderAgentInstruction(agent), "utf8");
    artifacts.push(
      normalizeArtifact(
        {
          id: `artifact-${agentId}-instructions`,
          title: `${agent.displayName ?? agentId} Instructions`,
          category: "codex-agent-instructions",
          path: relativePath,
          owningAgent: agentId,
          workstream: agent.workstream ?? "",
          status: "complete",
          description: `Operating instructions for ${agent.displayName ?? agentId}`,
        },
        new Date().toISOString(),
      ),
    );
  }

  return artifacts;
}

function renderAgentInstruction(agent) {
  const lines = [
    `# ${agent.displayName ?? agent.id ?? "Agent"}`,
    "",
    `- Agent ID: ${agent.id ?? ""}`,
    `- Role: ${agent.role ?? ""}`,
    `- Workstream: ${agent.workstream ?? ""}`,
    `- Status: ${agent.status ?? "queued"}`,
    `- Model: ${agent.model ?? "platform-default"}`,
    `- Reasoning Effort: ${agent.reasoningEffort ?? "medium"}`,
    `- Mode: ${agent.agentMode ?? "manual"}`,
    "",
    "## Responsibility",
    "",
    agent.responsibility || "No responsibility recorded.",
    "",
    "## Current Task",
    "",
    agent.currentTask || "Waiting for assignment.",
    "",
    "## Initial Prompt",
    "",
    agent.initialPrompt || "No initial prompt recorded.",
    "",
    "## Expected Output",
    "",
    agent.expectedOutput || "No expected output recorded.",
  ];

  if (agent.boundaries?.length) {
    lines.push("", "## Boundaries", "", ...agent.boundaries.map((boundary) => `- ${boundary}`));
  }

  return `${lines.join("\n")}\n`;
}

function mergeArtifacts(explicitArtifacts, generatedArtifacts) {
  const byPath = new Map();
  for (const artifact of generatedArtifacts) byPath.set(artifact.path || artifact.id, artifact);
  for (const artifact of explicitArtifacts) byPath.set(artifact.path || artifact.id, artifact);
  return [...explicitArtifacts, ...generatedArtifacts].filter((artifact, index, artifacts) => {
    const key = artifact.path || artifact.id;
    return artifacts.findIndex((candidate) => (candidate.path || candidate.id) === key) === index;
  }).map((artifact) => byPath.get(artifact.path || artifact.id));
}

function normalizeWorkstream(workstream) {
  return {
    id: workstream.id,
    name: workstream.name,
    purpose: workstream.purpose ?? "",
    status: normalizeStatus(workstream.status ?? "queued"),
    dependencies: workstream.dependencies ?? [],
    blockers: workstream.blockers ?? [],
  };
}

function normalizeArtifact(artifact, now) {
  const category = ARTIFACT_CATEGORIES.includes(artifact.category) ? artifact.category : "references";
  return {
    id: artifact.id ?? slugify(artifact.path ?? artifact.title ?? `artifact-${now}`),
    title: artifact.title ?? artifact.path ?? "Untitled Artifact",
    category,
    path: artifact.path ?? "",
    owningAgent: artifact.owningAgent ?? "",
    workstream: artifact.workstream ?? "",
    status: normalizeStatus(artifact.status ?? "queued"),
    description: artifact.description ?? "",
    createdAt: artifact.createdAt ?? now,
    updatedAt: artifact.updatedAt ?? now,
  };
}

function normalizeStatus(status) {
  return STATUS_VALUES.includes(status) ? status : "queued";
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main(argv) {
  const [command, ...args] = argv;
  if (command !== "init") {
    throw new Error("Usage: tengo-mgmt.mjs init --project-dir <path> --name <name> --goal <goal>");
  }

  const options = parseArgs(args);
  const state = createInitialState({
    project: {
      name: options.name,
      goal: options.goal,
      sourcePlatform: options.platform ?? "unknown",
      defaultModel: options.model,
      defaultReasoningEffort: options.reasoningEffort,
    },
  });
  await writeState(options.projectDir ?? process.cwd(), state);
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.replace(/^--/, "");
    const value = args[index + 1];
    if (key) options[key.replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value;
  }
  return options;
}

const entryPath = process.argv[1] ? fileURLToPath(import.meta.url) : "";
if (process.argv[1] === entryPath) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
