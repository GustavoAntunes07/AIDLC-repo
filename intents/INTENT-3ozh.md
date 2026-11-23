---
id: INTENT-3ozh
title: Consolidate installable AIDLC roadmap with observer and Unity preset
status: context_ready
story_points: 1
retry_count: 0
branch: intent/3ozh-consolidate-installable-aidlc-roadmap-with-observer-and-unity-preset
---

# Description

Consolidate the original installable CLI plan with the requested Task Observer capability, compact Unity game-development preset, per-role model configuration and multi-project maintenance. This planning intent changes roadmap/backlog documentation only; it does not implement or install the future CLI or skill.

# Acceptance Criteria

- [x] The original chat is read and the prior model-only delivery is distinguished from the CLI roadmap.
- [x] A durable roadmap covers core, packaging, adapters, safe updates/migrations, context and multi-project maintenance.
- [x] Preset, governance and harness remain independent, with existing runtime rules preserved.
- [x] Task Observer specifies project scope, attribution, evidence, activation and staged skill updates.
- [x] Unity Mini specifies compact intents, three roles, configurable models and separate playtest evidence.
- [x] Ordered implementation intents have acceptance criteria and explicit planning dependencies.
- [x] The roadmap is linked from AIDLC.md and no game-dev skills are searched or installed.

# Related Files

- `docs/aidlc-cli-roadmap.md`
- `AIDLC.md`
- `intents/INTENT-iyfk.md`
- `intents/INTENT-6xe7.md`
- `intents/INTENT-6xhv.md`
- `intents/INTENT-6xlf.md`
- `intents/INTENT-6xpb.md`
- `intents/INTENT-6xt7.md`
- `intents/INTENT-6xwp.md`
- `intents/INTENT-6y03.md`
- `intents/INTENT-6y3g.md`

# Implementation Notes

Created the requested roadmap and eight implementation backlog intents on this intent branch. Promoted safe updates to the second milestone. No runtime code, installed skills, harness models, game projects or active governance were changed.

# Test Notes

`bun aidlc:check`, `bun aidlc:validate`, `bun aidlc:doctor` and `git diff --check` passed. A direct link/content check verified eight distinct backlog intents, existing roadmap link targets and both requested capabilities. No runtime code changed; feature implementation tests were not run or claimed.

# Review Notes

The user accepted the roadmap, requested the approved model baseline in implementation plans, and authorized starting bootstrap development. The roadmap and model-specific backlog criteria now reflect that authorization. Runtime implementation review remains separate.

# Commits
