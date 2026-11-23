---
id: INTENT-6y3g
title: Manage versions across multiple project installations
status: backlog
story_points: 5
retry_count: 0
branch: intent/6y3g-manage-versions-across-multiple-project-installations
---

# Description

Add an opt-in local project registry and explicit inventory/update planning for projects using the same AIDLC framework.

## Dependencies

Recommended sequence dependencies: INTENT-6xe7, INTENT-6xhv, INTENT-6xlf, INTENT-6xpb, INTENT-6xt7, INTENT-6xwp, INTENT-6y03.
See [the shared roadmap](../docs/aidlc-cli-roadmap.md). These are planning dependencies; the current CLI does not enforce dependency metadata.

# Acceptance Criteria

- [ ] Projects register explicitly; there is no automatic disk-wide discovery.
- [ ] Inventory shows project path, installed/available version, preset, adapters and local drift.
- [ ] A multi-project dry-run identifies target versions, migrations and conflicts per project.
- [ ] Applying an update requires explicit project selection; one project failure does not corrupt others.
- [ ] Unavailable paths, active sessions and rollback requirements are surfaced before application.
- [ ] A CLI package release and an installed project upgrade remain distinct operations.

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
