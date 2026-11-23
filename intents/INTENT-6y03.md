---
id: INTENT-6y03
title: Add context manifests and reliable session resume
status: backlog
story_points: 5
retry_count: 0
branch: intent/6y03-add-context-manifests-and-reliable-session-resume
---

# Description

Build minimal per-intent context and resume records on top of lifecycle, evidence and observer storage, with explicit freshness checks.

## Dependencies

Recommended sequence dependencies: INTENT-6xe7, INTENT-6xhv, INTENT-6xlf, INTENT-6xpb, INTENT-6xt7, INTENT-6xwp.
See [the shared roadmap](../docs/aidlc-cli-roadmap.md). These are planning dependencies; the current CLI does not enforce dependency metadata.

# Acceptance Criteria

- [ ] context build/status/inspect and resume summarize intent, branch, decisions, evidence and pending work.
- [ ] Freshness checks use file/Git fingerprints and surface stale evidence.
- [ ] Context includes relevant observer references without loading the entire historical archive.
- [ ] Resume never invents test results, playtest outcomes, review approval or prior model execution.
- [ ] Versioned context survives updates and migration; parallel sessions do not overwrite each other.

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
