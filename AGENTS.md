# AI-DLC - Codex context

This repository uses an AI-assisted development lifecycle.

## Core rules

- Never commit without explicit user approval.
- Never push without explicit user approval.
- Always work from an intent file.
- Always update the intent status after each stage.
- Always run the project validation commands before marking work as complete.

## Workflow

1. Reader resolves context.
2. Planner refines the intent if needed.
3. Builder implements.
4. Tester validates.
5. Reviewer approves or rejects.
6. Documenter updates docs.

## Source of truth

- Global project rules: AIDLC.md
- Agent behavior: skills/
- Unit of work: intents/INTENT-*.md
- Architecture docs: docs/
