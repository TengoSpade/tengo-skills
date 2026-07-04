# tengo-skills

A collection of transferable AI skills for session management, workflow, and multi-agent project orchestration.

## Skills

### [wrap-up](./wrap-up/SKILL.md)

End a an AI session by writing a structured `.md` file that serves two readers: a human summary (what happened, what's next) and a dense token-optimized section for Claude to resume seamlessly.

**Invoke:** `/wrap-up`

Supports optional modifiers: `--compact` (runs `/compact` after saving), `--interactive` (Q&A before writing).

### [pick-up](./pick-up/SKILL.md)

Resume an AI session from a previously written wrap-up file. Auto-discovers the most recent wrap-up in `./wrap-ups/`, verifies environment state, re-populates todos, and stages the first action without executing it.

**Invoke:** `/pick-up` or `/pick-up path/to/wrap-up.md`

### [tengo-mgmt](./tengo-mgmt/SKILL.md)

Start and manage a per-project multi-agent workflow with an orchestrator agent, project-local `.orchestrator/` state, per-agent model assignments, and a local dashboard template.

**Invoke:** when coordinating project agents, creating an orchestration dashboard, assigning models to agents, or tracking workstreams.

---

## Installation

Root skill folders are the Claude Code / portable install targets. Copy the skill folder(s) into `~/.claude/skills/`:

```bash
# wrap-up
cp -r wrap-up ~/.claude/skills/wrap-up

# pick-up
cp -r pick-up ~/.claude/skills/pick-up

# tengo-mgmt
cp -r tengo-mgmt ~/.claude/skills/tengo-mgmt
```

Claude Code auto-discovers skills in `~/.claude/skills/` — no further config needed.

Platform-specific install targets are also provided:

```bash
# Codex
cp -r codex/wrap-up ~/.agents/skills/wrap-up
cp -r codex/pick-up ~/.agents/skills/pick-up
cp -r codex/tengo-mgmt ~/.agents/skills/tengo-mgmt

# Gemini
cp -r gemini/wrap-up <gemini-skills-dir>/wrap-up
cp -r gemini/pick-up <gemini-skills-dir>/pick-up
cp -r gemini/tengo-mgmt <gemini-skills-dir>/tengo-mgmt
```

---

## Usage

```
# At the end of a session
/wrap-up

# At the start of a new session in the same project
/pick-up

# When starting or managing a multi-agent project
Use tengo-mgmt to create project orchestration state and dashboard assets.
```
