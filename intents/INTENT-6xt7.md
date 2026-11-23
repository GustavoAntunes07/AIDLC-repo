---
id: INTENT-6xt7
title: Integrate project-scoped Task Observer with staged skill improvements
status: backlog
story_points: 5
retry_count: 0
branch: intent/6xt7-integrate-project-scoped-task-observer-with-staged-skill-improvements
---

# Description

Implement an optional observer capability shared by the full and compact workflows. Adapt the upstream methodology behind the core/adapters rather than silently installing a third-party global skill.

## Dependencies

Recommended sequence dependencies: INTENT-6xe7, INTENT-6xhv, INTENT-6xlf, INTENT-6xpb.
See [the shared roadmap](../docs/aidlc-cli-roadmap.md). These are planning dependencies; the current CLI does not enforce dependency metadata.

# Acceptance Criteria

- [ ] Observations include an identifier, date, intent/session source, sanitized evidence, target skill, proposal and review status.
- [ ] Logs are project-local by default; sharing or promoting a generalized observation is explicit.
- [ ] Concurrent append, duplicates and resumed sessions are handled without lost observations.
- [ ] Observation text is treated as data and cannot authorize commands, change governance or install skills.
- [ ] Skill changes are staged with a diff and applied only within user-authorized scope; system/plugin skills are not overwritten.
- [ ] doctor reports observer activation and last observed session; unavailable activation hooks are reported honestly.
- [ ] Update/migration preserves observations and review history; upstream license, attribution and chosen source revision are recorded.

- [ ] The observer reuses the active session for capture instead of requiring a separate model call per tool invocation; routine consolidation may use Luna high and proposed skill changes receive normal review.

## Model Implementation Plan

Keep observation capture lightweight and project-local; explicit skill update proposals follow the configured planner/builder/reviewer model policy rather than bypassing review.

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
