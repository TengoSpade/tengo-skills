---
name: wrap-up
description: Summarize the current Gemini session into a durable wrap-up .md file with sections for humans and a token-optimized section for Gemini to resume seamlessly. Use when the user says "wrap up", "wrap up the session", "summarize and save", "end of session", "close out this session", or invokes /wrap-up. Captures purpose, completed work, open items, next steps, active todos, git state, and a copy-paste resume prompt. Supports optional context compression and interactive Q&A modifiers.
---

# wrap-up

End a Gemini session by writing a structured wrap-up file. The file serves two readers: a human section (what happened, what's next) and a dense agent section (token-optimized context for seamless resume).

Pairs with the `pick-up` skill.

## Step 1 — Decide the mode

Parse the invocation text for modifiers:

- `--interactive`, "interactive", "ask me", "questions first" → **interactive mode**
- `--continues-from <filename>`, "continues from", "chain from" → **chain mode**; capture the predecessor filename. If no filename given, auto-discover the most recent wrap-up in `./wrap-ups/` (use `glob` on `./wrap-ups/*.md`, sort by name desc). If none found, warn the user and continue in standard mode.
- Modes compose: both can be active simultaneously.

If **no modifier** was specified, use `ask_user`:

- Question: "How should I wrap up?"
- Options:
  1. "Just create the wrap-up file" (default)
  2. "Wrap up with questions first" (interactive Q&A before writing)
  3. "Chain from previous" (links this wrap-up to the most recent existing one)
  4. "Wrap up with questions and chain from previous"

Respect the user's answer.

## Step 2 — Interactive Q&A (only if interactive mode is active)

Use `ask_user` to ask 2–4 focused questions to surface non-obvious context. Good targets:

- Blockers discussed verbally or implied but never named
- Decisions that were made but not spelled out
- Stakeholders / deadlines / external dependencies
- Scope changes the user hasn't stated explicitly

Keep questions multiple-choice where possible. Fold the answers into the wrap-up content in Step 4.

Skip this step entirely if interactive mode is not active.

## Step 3 — Gather environment state

Run these shell commands to gather git state:

```bash
git rev-parse --is-inside-work-tree 2>/dev/null
git branch --show-current
git status --short | wc -l
git log -1 --oneline
```

Also capture the **active todos** from the current session context — you already have this; no tool call needed. If there are no active todos, note "none".

Note: Detailed session token stats are not available. The Environment Snapshot omits token/cost data.

## Step 4 — Write the wrap-up file

**Scan for secrets.** Before writing, scan the text you've assembled for lines matching:
```
(api[_-]?key|secret[_-]?key|password|passwd|private[_-]?key|auth[_-]?token)\s*[:=]\s*[A-Za-z0-9+/._=-]{16,}
```
If any match, report to the user and ask to confirm before writing. If no matches, proceed silently.

**Path:** `./wrap-ups/<YYYY-MM-DD>-<HHMM>-<slug>.md`

- `<slug>` is a 2–4 word kebab-case summary of the session topic. Derive from the session's actual work.
- Create `./wrap-ups/` if missing.
- If in a git repo, ensure `wrap-ups/` is on a line by itself in `./.gitignore`. Append if absent. If `.gitignore` doesn't exist, create it with a single `wrap-ups/` line.

**Use this exact template:**

````markdown
# Session Wrap-up — <topic>
_<YYYY-MM-DD HH:MM> · <working-dir> · branch: <branch-or-"n/a">_
_↳ Continues from: [<predecessor-filename>](./wrap-ups/<predecessor-filename>)_ _(omit if not chain mode)_

## For People

### Purpose
<1–3 sentences on why this session happened and what the user set out to accomplish>

### Completed
- <deliverable>
- <deliverable>

### Open / In Progress
- <item> — <state / blocker>

### Next Steps
1. <specific, actionable next step>
2. <…>

### Environment Snapshot
- Branch: <name> · Uncommitted: <N> files · Last commit: <hash> <subject>
- Active todos: <N> (verbatim list in the agent section below)

---

## For Agent (resume context — token-optimized)

<!-- Dense, abbreviated. No prose flourishes. Prioritize file paths, function names, invariants, current state. -->

- **Goal:** <one line>
- **Stack/tools:** <list>
- **Key files:**
  - `path/to/file.ext:line` — <role>
- **State:** <what's done, what's next, shortest form>
- **Invariants/constraints:** <things that must hold>
- **Active todos:**
  - [ ] <todo 1>
  - [ ] <todo 2>
- **Open threads:** <unresolved questions / pending decisions>
- **Do NOT:** <known pitfalls, approaches ruled out>
- **Chain:** `./wrap-ups/<predecessor-filename>` → this file _(omit if not chain mode)_

### Resume instructions
Read this file. Verify state (git branch, file existence). First action: `<specific command or edit>`.

---

## Copy-paste prompt for new session

```
Resume this session. Read ./wrap-ups/<filename>.md — especially the "For Agent" section. Verify state, then execute the Resume instructions. First action: <specific thing>.
```

---

## Session Stats (machine-readable)

```json
{
  "continues_from": null
}
```
````

_`continues_from`: substitute the actual predecessor filename string when chain mode is active; leave as `null` when not._

**Writing guidance for the agent section:**

- Prefer lists over prose.
- Include `file:line` references wherever a specific location matters.
- Abbreviate: "fn" over "function", "impl" over "implementation", "w/" over "with".
- Do not restate content already in the "For People" section.
- Target: a fresh agent reads this once and has operating context for the next action.

## Step 5 — Memory sync

Review the wrap-up content for durable facts worth persisting. Good candidates:

- User role, responsibilities, domain expertise
- Project goals or constraints that outlive this session
- Explicit feedback ("don't do X because…", "prefer Y approach")
- Reference pointers (external dashboards, tracking systems, docs)

Use `save_memory` for each new durable fact. Keep each entry to one or two sentences. If a fact is already in memory and still accurate, skip it. If it's stale, update it.

## Step 6 — Report

At the end, in one short message, tell the user:

- Where the file was written.
- How many memory entries were added or updated (if any).
- The exact copy-paste prompt they can use in a new session (or remind them `/pick-up` also works).
