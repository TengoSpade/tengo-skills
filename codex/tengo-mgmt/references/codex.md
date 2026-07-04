# Codex Platform Reference

Use this reference when Tengo Mgmt is running in Codex.

## Agent Capabilities

Codex may expose in-session subagents and app thread tools. Use in-session subagents for bounded parallel work that can return in the current session. Use persistent Codex threads for longer-running agents that the user may want to inspect or message later.

If neither capability is available, create `.orchestrator/` state and mark agents `pending` or `manual`.

## Model And Reasoning

Only assign models and reasoning efforts supported by the active Codex host/tool. Keep the project default unless the user requests a specific model or the role clearly needs a stronger or faster model. If a model/reasoning pair is unavailable, fall back to the project default and write an event.

## Dashboard

Use the local dashboard template. Start it from the project workspace so it reads that project's `.orchestrator/` state. If localhost serving is blocked, continue with state files and retry dashboard startup when permission is available.

## State Handles

Store Codex-specific handles in `platformHandles.codex`. Keep the stable `agents.json` agent id as the primary identity.
