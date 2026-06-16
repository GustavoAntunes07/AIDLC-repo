# AI-DLC - Codex Context

This repository uses an AI-assisted development lifecycle.

## Core Rules

- Never commit without explicit user approval.
- Never push without explicit user approval.
- Always work from an intent file for implementation work.
- Always update the intent status after each completed stage.
- Before moving an intent to `in_development`, verify the current branch with `bun aidlc:branch <intent-id>`.
- Use `bun aidlc transition <intent-id> <status>` for lifecycle status changes.
- Always run project validation commands before marking work as complete.

## Out-Of-Lifecycle Questions

Questions, brainstorming, read-only analysis, and meta discussion do not require an intent.

An intent is required before:

- Editing files
- Running implementation, testing, review, or documentation stages
- Changing lifecycle status
- Making persistent repo/process changes

## Session Start And Script Rules

At the beginning of every session, run:

```bash
bun aidlc:check
```

If the setup is incomplete, run:

```bash
bun aidlc:setup
```

Periodically, to verify if everything is all right in the AI-DLC repo, run:

```bash
bun aidlc:doctor
```

## Runtime Configuration

The executable lifecycle configuration lives in:

```txt
.aidlc/config.yaml
```

It defines:

- Active governance profile
- Required agents
- Lifecycle transitions
- Approval gates
- Validation commands
- Branch enforcement

## Workflow

0. AI-DLC Orchestrator checks setup, reads workflow status, and recommends the next agent.
1. Reader resolves context.
2. Planner refines the intent if needed.
3. Builder verifies the intent branch, then implements.
4. Tester validates.
5. Reviewer approves or rejects.
6. Documenter updates docs.

The active governance profile decides where the workflow must pause for user approval.

## Agents

Agent definitions live in `.codex/agents/`.

Required agents:

- `aidlc-orchestrator`
- `reader`
- `planner`
- `builder`
- `tester`
- `reviewer`
- `documenter`

## Source Of Truth

- Global project rules: `AIDLC.md`
- Runtime workflow config: `.aidlc/config.yaml`
- Agent behavior: `.codex/agents/` and `skills/`
- Unit of work: `intents/INTENT-*.md`
- Architecture docs: `docs/`

## Codex Model Verification

Codex model defaults belong in `~/.codex/config.toml` or trusted project `.codex/config.toml`.

Common keys:

```toml
model = "gpt-5.5"
model_reasoning_effort = "high"
```

For runtime evidence, use Codex logs or OpenTelemetry events when enabled; conversation start events include model and reasoning settings.
