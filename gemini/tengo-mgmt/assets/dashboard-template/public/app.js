const state = {
  project: {},
  agents: [],
  workstreams: [],
  artifacts: [],
  commands: [],
  events: [],
};

const artifactCategoryLabels = {
  "codex-agent-instructions": "Codex / Agent Instructions",
  "generated-assets": "Generated Assets",
  "specs-wrapups": "Specs / Wrap-ups",
  "review-docs": "Review Docs",
  "source-outputs": "Source Outputs",
  "data-state": "Data / State",
  references: "References",
};

document.getElementById("refresh-button").addEventListener("click", loadDashboard);
document.getElementById("artifact-category-filter").addEventListener("change", renderArtifacts);
document.getElementById("chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("chat-input");
  const message = input.value.trim() || "Status?";
  addLocalMessage("You", message);
  input.value = "";
  try {
    const command = await queueOrchestratorMessage(message);
    addLocalMessage("Tengo Mgmt", `Queued command ${command.id} for Codex.`);
    await loadDashboard();
  } catch (error) {
    addLocalMessage("Tengo Mgmt", `Could not queue command: ${error.message}`);
  }
});
document.getElementById("agent-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  addLocalMessage(
    "Create agent",
    `${form.get("displayName") || "New agent"} is pending approval for ${form.get("workstream") || "a workstream"} using ${form.get("model") || "project default"} / ${form.get("reasoningEffort") || "medium"}.`,
  );
});

await loadDashboard();

async function loadDashboard() {
  const response = await fetch("/api/state");
  Object.assign(state, await response.json());
  renderProject();
  renderChat();
  renderWorkstreams();
  renderArtifacts();
  renderEvents();
}

function renderProject() {
  document.getElementById("project-name").textContent = state.project.name || "Orchestrator Chat";
  document.getElementById("project-platform").textContent = state.project.sourcePlatform || "manual";
}

function renderChat() {
  const log = document.getElementById("chat-log");
  log.replaceChildren(
    messageElement(
      "Orchestrator",
      `Tracking ${state.agents.length} agents across ${state.workstreams.length} workstreams. Pending Codex commands: ${pendingCommandCount()}.`,
    ),
  );
}

function renderWorkstreams() {
  const container = document.getElementById("workstreams");
  const lanes = state.workstreams.length
    ? state.workstreams
    : [{ id: "manual", name: "Manual", purpose: "Agents waiting to be connected" }];
  container.replaceChildren(...lanes.map(workstreamElement));
}

function renderEvents() {
  const list = document.getElementById("events");
  const events = state.events.length
    ? state.events
    : [{ type: "dashboard.loaded", message: "Dashboard loaded from .orchestrator state" }];
  list.replaceChildren(
    ...events.slice(-12).map((event) => {
      const item = document.createElement("li");
      item.className = "event-item";
      item.textContent = `${event.type}: ${event.message || event.agentId || "recorded"}`;
      return item;
    }),
  );
}

function renderArtifacts() {
  const container = document.getElementById("artifacts");
  const selectedCategory = document.getElementById("artifact-category-filter").value;
  const artifacts = selectedCategory === "all"
    ? state.artifacts
    : state.artifacts.filter((artifact) => artifact.category === selectedCategory);

  if (!artifacts.length) {
    const empty = document.createElement("article");
    empty.className = "artifact-card";
    empty.textContent = "No artifacts found for this category yet.";
    container.replaceChildren(empty);
    return;
  }

  container.replaceChildren(...artifacts.map(artifactElement));
}

function artifactElement(artifact) {
  const card = document.createElement("article");
  card.className = "artifact-card";
  card.innerHTML = `
    <div>
      <p class="meta">${escapeHtml(artifactCategoryLabels[artifact.category] || "References")}</p>
      <h3>${escapeHtml(artifact.title || artifact.path || "Untitled Artifact")}</h3>
    </div>
    <p class="artifact-path">${escapeHtml(artifact.path || "No path recorded")}</p>
    <p>${escapeHtml(artifact.description || "No description recorded")}</p>
    <p class="meta">Status: ${escapeHtml(artifact.status || "recorded")} | Owner: ${escapeHtml(artifact.owningAgent || "unassigned")} | Workstream: ${escapeHtml(artifact.workstream || "none")}</p>
  `;
  return card;
}

function workstreamElement(workstream) {
  const section = document.createElement("article");
  section.className = "workstream-lane";
  const agents = state.agents.filter((agent) => agent.workstream === workstream.id || agent.workstream === workstream.name);
  section.innerHTML = `
    <h3>${escapeHtml(workstream.name)}</h3>
    <p class="meta">${escapeHtml(workstream.purpose || "No purpose recorded")}</p>
    <div class="agent-list"></div>
  `;
  const list = section.querySelector(".agent-list");
  list.replaceChildren(...(agents.length ? agents.map(agentElement) : [emptyAgentElement()]));
  return section;
}

function agentElement(agent) {
  const card = document.createElement("article");
  card.className = "agent-card";
  card.innerHTML = `
    <h3>${escapeHtml(agent.displayName || agent.id)}</h3>
    <p>${escapeHtml(agent.role || "No role recorded")}</p>
    <p class="meta">Status: ${escapeHtml(agent.status || "pending")} | Model: ${escapeHtml(agent.model || "project default")} | Reasoning: ${escapeHtml(agent.reasoningEffort || "medium")}</p>
    <p class="meta">Task: ${escapeHtml(agent.currentTask || "Waiting")}</p>
    <div class="agent-actions"></div>
  `;
  const actions = card.querySelector(".agent-actions");
  const startButton = document.createElement("button");
  startButton.className = "secondary-button";
  startButton.type = "button";
  startButton.textContent = "Start";
  startButton.addEventListener("click", async () => {
    startButton.disabled = true;
    try {
      const command = await queueAgentStart(agent.id);
      addLocalMessage("Tengo Mgmt", `Queued ${agent.displayName || agent.id} start command ${command.id} for Codex.`);
      await loadDashboard();
    } catch (error) {
      addLocalMessage("Tengo Mgmt", `Could not queue agent start: ${error.message}`);
      startButton.disabled = false;
    }
  });
  actions.append(startButton);
  return card;
}

function emptyAgentElement() {
  const empty = document.createElement("div");
  empty.className = "agent-card";
  empty.textContent = "No agents yet. Create agent proposals from chat or the side panel.";
  return empty;
}

function addLocalMessage(sender, text) {
  document.getElementById("chat-log").append(messageElement(sender, text));
}

async function queueOrchestratorMessage(message) {
  return postJson("/api/orchestrator/message", { message });
}

async function queueAgentStart(agentId) {
  return postJson(`/api/agents/${encodeURIComponent(agentId)}/start`, {});
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  const payload = await response.json();
  return payload.command;
}

function pendingCommandCount() {
  return state.commands.filter((command) => command.status === "queued").length;
}

function messageElement(sender, text) {
  const message = document.createElement("div");
  message.className = "message";
  message.innerHTML = `<strong>${escapeHtml(sender)}</strong><p>${escapeHtml(text)}</p>`;
  return message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
