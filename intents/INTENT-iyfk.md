---
id: INTENT-iyfk
title: Update agent model assignments to GPT-6 and record CLI roadmap
status: done
story_points: 1
retry_count: 0
branch: intent/iyfk-update-agent-model-assignments-to-gpt-6-and-record-cli-roadmap
---

# Description

Move the Codex agent definitions to GPT-6 models. Use GPT-6 Luna for lightweight coordination, context gathering, testing, and documentation; GPT-6 Sol for planning and implementation; reserve GPT-6 Astra for infrequent, high-value review work because of its higher cost.

The supplied AIDLC CLI plan is future product context for this intent: evolve the repository template toward an installable CLI and shared core, starting with init/configuration/doctor, then intent lifecycle, harness adapters, context/resume, and update/migration support. This intent only updates model assignments and their documentation; CLI implementation should be split into later intents.

# Acceptance Criteria

- [x] All seven Codex agent definitions use GPT-6 Luna, Sol, or Astra, with Astra assigned only to the reviewer.
- [x] Model verification examples in project guidance use current GPT-6 model names.
- [x] The supplied CLI direction is captured as context for future intents without implementing CLI features.

## Technical Plan

- Assign Luna to the orchestrator, reader, tester, and documenter.
- Assign Sol to the planner and builder.
- Assign Astra to the reviewer only.
- Update Codex model verification examples in `AGENTS.md` and `AIDLC.md`.
- Validate the repository using its configured doctor command.

# Related Files

- `.codex/agents/*.toml`
- `AGENTS.md`
- `AIDLC.md`
- `.aidlc/config.yaml`
- `intents/INTENT-iyfk.md`

# Implementation Notes

- Assigned `gpt-6-luna` to `aidlc-orchestrator`, `reader`, `tester`, and `documenter`.
- Assigned `gpt-6.1-sol` to `planner` and `builder`.
- Reserved `gpt-6-astra` for `reviewer` because it is the higher-cost model.
- Updated Codex model examples in `AGENTS.md` and `AIDLC.md` and added an agent model allocation table to `AIDLC.md`.
- Kept the CLI plan as future context in this intent; no CLI features were implemented.

# Test Notes

- `bun aidlc:doctor` passed: setup complete, all intents valid.
- `git diff --check` passed; Git reported only LF-to-CRLF normalization warnings.
- Searched `.codex/agents`, `AGENTS.md`, and `AIDLC.md`; no GPT-5 model references remain.

# Review Notes

Approved.

- All seven Codex agent definitions use the documented GPT-6 model assignments.
- Astra is limited to the reviewer; Luna and Sol are used for the more frequent roles.
- The model verification examples match the assigned GPT-6 model family.
- The CLI proposal is recorded as future intent context and no CLI scope was added to this change.
- `bun aidlc:doctor` and `git diff --check` passed.

# Commits
