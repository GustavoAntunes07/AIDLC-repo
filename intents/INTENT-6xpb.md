---
id: INTENT-6xpb
title: Generate harness adapters and role model configuration
status: backlog
story_points: 5
retry_count: 0
branch: intent/6xpb-generate-harness-adapters-and-role-model-configuration
---

# Description

Define canonical role responsibilities and per-role model/reasoning settings, then render harness-specific files with ownership tracking.

## Dependencies

Recommended sequence dependencies: INTENT-6xe7, INTENT-6xhv, INTENT-6xlf.
See [the shared roadmap](../docs/aidlc-cli-roadmap.md). These are planning dependencies; the current CLI does not enforce dependency metadata.

# Acceptance Criteria

- [ ] Codex and Claude adapters are explicit capabilities with independent integration checks.
- [ ] sync is idempotent and preserves user instructions and local overrides.
- [ ] Planner, builder and reviewer have independently configurable model identifiers and reasoning settings.
- [ ] The adapter distinguishes generated configuration from actual execution; unsupported model switching is reported.
- [ ] Model availability and runtime settings are verified on the target harness before claiming a successful model assignment.
- [ ] Review uses an independent context; an unavailable reviewer is a pending validation, never self-approval.

- [ ] The approved baseline is Luna high for orchestrator/reader/documenter, Sol 6.2 high for planner and routine reviewer, and Sol 6.2 medium for builder/tester.
- [ ] Astra 6.2 high is an explicit escalation for high-risk or inconclusive reviews, not a mandatory model for every intent.

## Model Implementation Plan

Generate role settings from project overrides over the approved baseline. Validate availability in the target harness. Keep routine review in an independent context and require explicit escalation to the specialist model. Terra 6.1 may be an optional visual/computer-use binding, not a required coding role.

# Related Files

- `docs/aidlc-cli-roadmap.md`
- `scripts/aidlc.ts`
- `.aidlc/config.yaml`
- `AIDLC.md`
- `AGENTS.md`
- `tests/aidlc.test.ts`

# Implementation Notes

Planned. No runtime implementation in the roadmap update.

# Test Notes

Acceptance scenarios above define the implementation checks. Not yet executed for this future feature.

# Review Notes

Pending implementation and independent review under the active governance profile.

# Commits
