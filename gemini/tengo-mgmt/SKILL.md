---
name: tengo-mgmt
description: Use when coordinating a project with an orchestrator agent, managing multiple project agents or subagents, creating a project-local agent dashboard, assigning models to agents, or tracking agent workstreams and status.
---

# Tengo Mgmt

Tengo Mgmt is a platform-neutral orchestration skill. Use it to help a user start and manage a per-project team of agents with a local dashboard and shared `.orchestrator/` state.

## Core Flow

1. Inspect the project enough to understand repo shape, docs, constraints, and likely workstreams.
2. Identify the current platform. Load only the matching reference:
   - Codex: `references/codex.md`
   - Claude Code: `references/claude-code.md`
   - Gemini: `references/gemini.md`
3. Ask concise intake questions about goal, constraints, success criteria, workstreams, autonomy, and default model/reasoning preferences.
4. Propose a conservative initial team. Each proposed agent must include role, workstream, responsibility, initial prompt, expected output, model, reasoning effort, agent mode, and boundaries.
5. Create the initial `.orchestrator/` state with `scripts/tengo-mgmt.mjs`.
6. Create initial agents automatically when platform tools support it. If they do not, mark agents `pending` or `manual`.
7. Start or copy the dashboard template from `assets/dashboard-template/`.
8. Keep state updated as agents are messaged, blocked, completed, reassigned, or closed.

## Agent Creation Rules

Initial agents may be created automatically after intake. After setup, every new agent requires user approval from either the dashboard or the active chat session.

Use project defaults for model and reasoning effort unless there is a clear role-specific reason to differ. Stronger models fit architecture, review, planning, and ambiguous work. Faster or smaller models fit bounded inspection, formatting, or narrow implementation.

If a selected model or reasoning effort is unavailable on the current platform, use the closest project default, record an event, and surface the mismatch in the dashboard.

## State Contract

The shared state lives in `.orchestrator/`:

- `project.json`: project identity, goal, constraints, success criteria, source platform, and default model policy.
- `agents.json`: stable project-local agent ids plus optional platform handles.
- `workstreams.json`: project workstream lanes, dependencies, blockers, and status.
- `events.jsonl`: append-only activity feed.

Do not make dashboard behavior depend on a platform-specific thread or session id. Store those ids only as optional handles on a stable agent id.

## Dashboard

The dashboard is per-project and chat-first. It should show:

- Orchestrator chat as the main surface.
- Workstream lanes.
- Agent cards with status, current task, blockers, model, reasoning effort, and actions.
- Proposed-agent creation with an approval step after initial setup.
- Recent activity from `events.jsonl`.

Use `assets/dashboard-template/` as the starting dashboard. The first version favors clear operations over aesthetic polish.

## Fallbacks

When platform agent tools are unavailable, still run intake, write state, start the dashboard, and mark agents `pending` or `manual`. Tell the user what must be connected manually.

When dashboard startup fails, continue with file-backed orchestration and explain how to retry.
