# Claude Code Platform Reference

Use this reference when Tengo Mgmt is running in Claude Code.

## Agent Capabilities

Claude Code environments may support subagents or task delegation depending on installed tools and permissions. Use available subagent/session tools for bounded agent work. If no agent tool is available, keep the agent in `pending` or `manual` status and record the intended prompt in state.

## Model And Reasoning

Use only models and thinking/reasoning controls exposed by the current Claude Code environment. Prefer project defaults. Escalate to stronger models for architecture, review, and ambiguous work only when the platform supports it or the user approves.

## Dashboard

Run the dashboard template from the project root. The dashboard is a local web app over `.orchestrator/` state and does not require Codex-specific APIs.

## State Handles

Store Claude-specific session or subagent ids in `platformHandles.claudeCode`. Keep the stable project-local agent id as the dashboard identity.
