---
name: onboard
description: >
  Use this skill when a new developer needs to understand a project, or when documentation needs to be generated to help future contributors get up to speed. Trigger on prompts like "explain this project to me", "I'm new to this codebase", "help me understand what this does", "write onboarding docs", "create a README", "document how to set this up", "what is this project about", or any time someone is orienting themselves in an unfamiliar codebase. Also trigger when the user asks to prepare materials so someone else can contribute. Do NOT trigger for narrow implementation questions about a specific file or function — that is a code-reading task, not onboarding.
---

# Onboard Skill

Either explains a project to someone who just joined, or generates structured onboarding documentation — depending on what the user needs.

---

## Two modes

### Mode A — "Explain this to me"
The user is new and wants to understand the project. Produce a clear, conversational explanation tailored to their level.

### Mode B — "Generate onboarding docs"
The user wants written documentation for others. Produce a structured markdown document ready to drop into the repo.

If the user's intent is ambiguous, default to **Mode A** and offer to generate docs at the end.

---

## Mode A — Explaining the project

### Step 1 — Read the codebase structure
Before saying anything, explore:
- Root directory layout
- `package.json` / `pyproject.toml` / `Cargo.toml` (or equivalent) for dependencies and scripts
- `README.md` if it exists (note if it's missing or outdated)
- Entry points (`main`, `index`, `app`, `server`)
- Folder structure (features, modules, layers)
- Config files (env, Docker, CI)

### Step 2 — Deliver the explanation in layers

**Layer 1 — What is this?**
One paragraph. What does this project do, who uses it, and why does it exist?

**Layer 2 — How is it structured?**
Walk through the main folders/modules and explain their responsibility. Use a simple diagram if the structure is non-trivial:
```
src/
  api/        → HTTP handlers and route definitions
  services/   → Business logic
  db/         → Database models and migrations
  utils/      → Shared helpers
```

**Layer 3 — How do I run it?**
List the commands needed to install, configure, and start the project locally. Include environment variables if visible in `.env.example` or config files.

**Layer 4 — How does the code flow?**
Pick the most important user-facing flow and trace it end-to-end (e.g. "when a user submits a form, here's what happens..."). Keep it concrete.

**Layer 5 — What should I touch first?**
Recommend 2–3 good "starter" files to read for orientation, and 1–2 good first tasks if relevant.

---

## Mode B — Generating onboarding documentation

Produce a markdown file with the following structure:

```markdown
# [Project Name] — Onboarding Guide

## What is this project?
[1–2 paragraphs: purpose, users, context]

## Architecture Overview
[Folder structure with annotations, key decisions explained]

## Tech Stack
[List: language, framework, database, infra, testing]

## Getting Started
### Prerequisites
### Installation
### Environment Variables
### Running Locally
### Running Tests

## How the Code is Organized
[Module/layer breakdown with responsibility of each]

## Key Flows
[1–3 critical flows traced end-to-end]

## Common Tasks
[How to add a feature, fix a bug, run migrations, etc.]

## Conventions & Standards
[Naming, formatting, PR process, commit style if visible]

## Who to Ask
[Leave as placeholder if unknown: `<!-- TODO: add team contacts -->`]
```

Populate each section from the actual codebase. Mark anything uncertain with `<!-- TODO: verify -->` rather than guessing.

---

## Guidelines

- **Read before writing.** Never generate docs without first exploring the actual file structure and key files.
- **Be honest about gaps.** If something is unclear or undocumented, say so — don't fill in gaps with assumptions presented as facts.
- **Match the reader's level.** For Mode A, ask or infer the person's experience level and adjust technical depth accordingly.
- **Keep it navigable.** Long docs should have a table of contents. Explanations should go from high-level to detail, not the reverse.
- **Flag outdated READMEs.** If the existing README is stale or missing, note it and offer to replace or supplement it.

---

## Example trigger phrases

- "I just joined this project, help me understand it"
- "Explain what this codebase does"
- "Write onboarding docs for this repo"
- "Create a README with setup instructions"
- "Walk me through how this project is structured"
- "What should a new dev read first in this project?"