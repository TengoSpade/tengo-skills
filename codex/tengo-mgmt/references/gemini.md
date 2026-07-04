# Gemini Platform Reference

Use this reference when Tengo Mgmt is running in Gemini.

## Agent Capabilities

Gemini environments vary in skill activation, shell access, and agent/session support. Use available session or delegation tools when present. If they are missing, create the recommended team in `.orchestrator/` with agents marked `pending` or `manual`.

## Model And Reasoning

Use only Gemini models and reasoning controls exposed in the current environment. Keep project defaults unless the user asks for a different model or a role-specific model is clearly justified.

## Dashboard

The dashboard template is platform-neutral. Start it from the project root so it can read `.orchestrator/` files. If the platform cannot run the local server, the state files remain the source of truth.

## State Handles

Store Gemini-specific session or agent ids in `platformHandles.gemini`. Keep the stable project-local agent id as the portable identity.
