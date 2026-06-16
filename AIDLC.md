# AI-DLC

AI-assisted Development Lifecycle for repositories that use coding agents.

---

# Project

## Project Setup Check

A project is considered configured when:

- Project name is defined
- Project description is defined
- Tech stack is defined
- Main commands are defined
- Default branches are defined
- `.aidlc/config.yaml` exists and is valid
- Required Codex agents exist in `.codex/agents/`
- No template placeholders remain

## Description

AI-DLC is a repository template and workflow contract for using Codex-style coding agents in a controlled development lifecycle. It keeps agent work tied to explicit intents, separates planning from implementation and review, and provides a CLI that validates setup, intent structure, governance rules, and lifecycle transitions.

Primary users are developers who want AI agents to work inside a repeatable process instead of ad hoc chat sessions.

## Tech Stack

- Bun
- TypeScript
- Markdown
- TOML agent configuration
- YAML lifecycle configuration

## Main Commands

### Install

```bash
bun install
```

### Check Setup

```bash
bun aidlc:check
```

### Create Intent

```bash
bun aidlc:new "Add login page"
```

### Status

```bash
bun aidlc:status
```

### Verify Intent Branch

```bash
bun aidlc:branch INTENT-001
```

### Doctor

```bash
bun aidlc:doctor
```

---

# Core Rules

These rules override any agent-specific behavior.

- Always work from an intent file.
- Never commit without explicit developer approval.
- Never push without explicit developer approval.
- Update the intent after each completed stage.
- Use the CLI state machine for status transitions.
- Verify the intent branch before moving to `in_development`.
- Run project validation before marking an intent as approved or done.
- Never modify unrelated code.
- Never change architecture without notifying the developer.
- Every implementation intent should have its own development branch unless the developer explicitly chooses otherwise.

Branch naming convention:

```txt
intent/<intent-id>-<short-description>
```

Example:

```txt
intent/001-add-login-page
```

Unless explicitly requested by the developer, implementation should not occur directly in the default development branch.

---

# Out-Of-Lifecycle Work

Users may ask questions outside the development lifecycle. These interactions do not need an intent when they are read-only and do not change repository state.

No intent is required for:

- Questions
- Explanations
- Brainstorming
- Read-only exploration
- Meta discussion about AI-DLC itself

An intent is required for:

- File edits
- Code changes
- Tests
- Review
- Documentation updates
- Lifecycle transitions
- Persistent repo/process changes

If a read-only discussion turns into implementation work, create or select an intent before editing files.

---

# Source of Truth

- Global project rules: `AIDLC.md`
- Runtime lifecycle configuration: `.aidlc/config.yaml`
- Agent behavior: `.codex/agents/` and `skills/`
- Unit of work: `intents/INTENT-*.md`
- Architecture docs: `docs/`

When documentation and `.aidlc/config.yaml` disagree, the config controls CLI behavior and the documentation should be updated.

---

# Governance Profiles

Governance profiles define how often the workflow must stop for developer approval. The active profile is configured in `.aidlc/config.yaml`.

## strict

Stops after every lifecycle stage. Use this for high-risk work, architecture changes, security-sensitive changes, or when onboarding a new workflow.

## standard

Requires approval before implementation starts and before final completion. Use this for normal feature work where planning and final sign-off matter most.

## autonomous

Allows the agent to continue until validation fails, review rejects the work, or a risk/blocker needs developer input. Use this for low-risk, well-scoped maintenance tasks.

---

# Human Approval Gates

The current governance profile determines where the workflow pauses. When a configured gate is reached, the agent should ask the developer whether to:

- Continue to the next stage
- Repeat the current stage
- Stop the workflow
- Modify the intent
- Change the implementation approach

Example:

```txt
Builder completed INTENT-005.

The implementation is ready for testing.

The strict governance profile requires approval at ready_for_testing.

Would you like me to:
1. Continue to Tester
2. Review the implementation together
3. Rework the implementation
4. Stop here
```

---

# Intent Lifecycle

The lifecycle is enforced by `.aidlc/config.yaml` and the CLI transition command.

```txt
backlog
    |
    v
context_ready
    |
    v
in_development
    |
    v
ready_for_testing
    |
    v
review
    |
    v
approved
    |
    v
done
```

Rejected intents return to:

```txt
in_development
```

Escalated intents return to:

```txt
backlog
```

after being rewritten.

Before moving an intent to `in_development`, verify the current branch:

```bash
bun aidlc:branch INTENT-001
```

When branch enforcement is enabled, `context_ready -> in_development` fails if the current Git branch does not match the intent's `branch:` field.

Use:

```bash
bun aidlc transition INTENT-001 context_ready
```

or:

```bash
bun scripts/aidlc.ts transition INTENT-001 context_ready
```

---

# Definition of Ready

An intent may only move from `backlog` to `context_ready` when:

- Description exists
- Acceptance criteria exist
- Scope is reasonably clear
- Required project context is available
- Related files are recorded when applicable

---

# Definition of Done

An intent may only be marked as `done` when:

- Acceptance criteria are satisfied
- Acceptance criteria are checked in the intent
- Tests or validation commands pass
- Test Notes record the validation result
- Reviewer approved the implementation
- Review Notes record the approval
- Documentation was updated if necessary
- Developer explicitly approved completion

---

# Agents

## AI-DLC Orchestrator

### Purpose

Coordinate the lifecycle without implementing, testing, or reviewing code.

### Responsibilities

- Run `aidlc check-setup`
- Run `aidlc doctor`
- Determine the current stage
- Suggest the next agent
- Explain workflow status
- Point to the active governance profile and approval gate

### Output

- Workflow status
- Recommended next agent
- Validation summary

### Restrictions

- Never implement code
- Never modify files
- Never review code
- Never create tests

---

## Reader

### Purpose

Find relevant project context.

### Responsibilities

- Read the intent
- Explore the codebase
- Identify relevant files
- Identify dependencies
- Identify related documentation
- Populate the Related Files section

### Output

- Context manifest
- Related files list

### Restrictions

- Never implement code
- Never modify architecture
- Never perform testing

---

## Planner

### Purpose

Refine requirements and implementation strategy.

### Responsibilities

- Clarify scope
- Improve acceptance criteria
- Break large intents into smaller intents
- Suggest implementation approaches
- Suggest architectural changes when needed

### Output

- Updated intent
- Refined acceptance criteria
- Technical plan

### Restrictions

- Never implement code

---

## Builder

### Purpose

Implement the intent.

### Responsibilities

- Read the intent
- Read related files
- Follow acceptance criteria
- Implement the required functionality
- Update Implementation Notes
- Create or update the intent branch when approved by the developer

### Output

- Working implementation
- Updated Implementation Notes

### Restrictions

- Never perform review
- Never approve its own work
- Never modify unrelated code
- Never continue past a required approval gate automatically

---

## Tester

### Purpose

Validate functionality.

### Responsibilities

- Create missing tests
- Update outdated tests
- Execute project validation commands
- Document test results
- Update Test Notes

### Output

- Passing tests or a clear failure report
- Updated Test Notes

### Restrictions

- Never approve implementation
- Never perform code review

---

## Reviewer

### Purpose

Validate quality and readiness.

### Responsibilities

- Validate acceptance criteria
- Validate architecture consistency
- Validate security concerns
- Validate maintainability
- Validate test coverage
- Validate coding standards
- Approve or reject implementation

### Output

- Approval decision
- Review Notes

### Restrictions

- May reject implementation
- Must not implement code
- Must not modify implementation

---

## Documenter

### Purpose

Keep documentation synchronized.

### Responsibilities

- Update documentation
- Update changelog
- Update architecture docs when necessary
- Remove outdated information

### Output

- Updated documentation

### Restrictions

- Never modify business logic

---

# Pipeline Configuration

Pipeline behavior belongs in:

```txt
.aidlc/config.yaml
```

The config defines:

- Active governance profile
- Branch naming
- Branch enforcement
- Maximum review cycles
- Validation commands
- Required agents
- Approval gates
- Lifecycle transitions

---

# Codex Model And Reasoning Verification

Codex model defaults belong in `~/.codex/config.toml`. Trusted repositories can also provide project-scoped overrides in `.codex/config.toml`.

Common settings:

```toml
model = "gpt-5.5"
model_reasoning_effort = "high"
```

Configuration precedence, highest first:

- CLI flags and `--config` overrides
- Trusted project `.codex/config.toml`
- Selected profile config
- User `~/.codex/config.toml`
- System config
- Built-in defaults

To verify intended configuration:

```bash
codex --model gpt-5.5
codex --config model_reasoning_effort='"high"'
```

For runtime evidence, enable Codex logs or OpenTelemetry. Conversation start events include model and reasoning settings, which are stronger evidence than reading config files alone.

---

# Intent Schema

Each intent is stored inside:

```txt
intents/
```

Example:

```md
---
id: INTENT-001
title: Add login page
status: backlog
story_points: 3
retry_count: 0
branch: intent/001-add-login-page
---

# Description

Add user authentication with email and password.

# Acceptance Criteria

- [ ] User can log in
- [ ] User can log out
- [ ] Errors are handled correctly

# Related Files

# Implementation Notes

# Test Notes

# Review Notes

# Commits
```

---

# Repository Structure

```txt
.
|-- AGENTS.md
|-- AIDLC.md
|-- intents/
|-- docs/
|-- skills/
|-- .aidlc/
|   |-- config.yaml
|   `-- state.json
|-- .codex/
|   `-- agents/
`-- scripts/
```

---

# Agent Configuration

Agent-specific behavior belongs in:

```txt
.codex/agents/
```

Expected agent files:

```txt
aidlc-orchestrator.toml
reader.toml
planner.toml
builder.toml
tester.toml
reviewer.toml
documenter.toml
```

Agent files define responsibilities. Workflow rules belong in `AIDLC.md` and executable workflow configuration belongs in `.aidlc/config.yaml`.
