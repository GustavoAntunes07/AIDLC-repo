---
id: INTENT-6xlf
title: Expose intent lifecycle and configurable workflow presets
status: backlog
story_points: 5
retry_count: 0
branch: intent/6xlf-expose-intent-lifecycle-and-configurable-workflow-presets
---

# Description

Move intent, branch and governance logic into the shared core. Separate full and compact intent schemas while preserving old identifiers and statuses.

## Dependencies

Recommended sequence dependencies: INTENT-6xe7, INTENT-6xhv.
See [the shared roadmap](../docs/aidlc-cli-roadmap.md). These are planning dependencies; the current CLI does not enforce dependency metadata.

# Acceptance Criteria

- [ ] intent new/list/show, status, branch and intent transition use the same core as legacy commands.
- [ ] Workflow presets define required roles, intent fields and allowed transitions independently of governance.
- [ ] default preserves the existing lifecycle; a compact schema supports five normal states and closed/escalated escape paths.
- [ ] Readiness, completion evidence, branch checks and approval gates are enforced for each preset.
- [ ] Invalid or unsupported preset/schema combinations fail clearly instead of silently falling back.
- [ ] Migration preserves existing intents and terminal statuses.

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
