# AI-DLC

AI-assisted development lifecycle for this repository.

## Project

Description: ...

Tech stack:

- ...

Main commands:

- Install: `bun install`
- Dev: `bun dev`
- Lint: `bun lint`
- Test: `bun test`
- Build: `bun build`

## Core rules

- Always work from an intent file.
- Never commit.
- Never push.
- Update the intent after each stage.
- Run validation before marking an intent as approved or done.
- Every intent should have his own branch for the development, with his code and name, unless the user asks to not do that and develop in dev.

## Intent lifecycle

backlog → context_ready → in_development → ready_for_testing → review → approved → done

Always ask for the developer if you can continue with this cycle after completing a step. For example: the development it's done, but first you ask if it can go to testing, if you should stop or re-do the development.

Rejected intents return to `in_development`. (it can be rejected from the user or from the reviewer agent)

Escalated intents return to `backlog` after being rewritten.

## Agents

### Reader

Finds relevant files and writes the context manifest.

### Planner

Refines requirements, acceptance criteria, and technical approach.

### Builder

Implements the intent.

### Tester

Adds or updates tests and runs validation.

### Reviewer

Checks quality, architecture, security, and acceptance criteria.

### Documenter

Updates docs and changelog.

## Pipeline config

max_review_cycles: 3
default_branch: main
default_development_branch: dev
review_mode: manual
branch_prefix: intent/

## Intent schema

Each intent lives in `intents/`.

Example:

```md
---
id: INTENT-001
title: Add login page
status: backlog
story_points: 3
retry_count: 0
branch: null
---

## Description

...

## Acceptance criteria

- [ ] ...

## Related files

## Implementation notes

## Test notes

## Review notes

## Commits
