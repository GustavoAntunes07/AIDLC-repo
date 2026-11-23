---
id: INTENT-6xwp
title: Add Unity Mini preset with compact intents and playtest evidence
status: backlog
story_points: 5
retry_count: 0
branch: intent/6xwp-add-unity-mini-preset-with-compact-intents-and-playtest-evidence
---

# Description

Add an installable and updatable unity-mini preset using the same core, with planner/builder/reviewer roles, observer activation, configurable models and external skill bindings.

## Dependencies

Recommended sequence dependencies: INTENT-6xe7, INTENT-6xhv, INTENT-6xlf, INTENT-6xpb, INTENT-6xt7.
See [the shared roadmap](../docs/aidlc-cli-roadmap.md). These are planning dependencies; the current CLI does not enforce dependency metadata.

# Acceptance Criteria

- [ ] init --preset unity-mini --harness codex installs into an existing Unity project without modifying game assets or project settings.
- [ ] Compact intents capture objective, scope, acceptance, short plan, evidence and status/branch; kinds include feature, bug and experiment.
- [ ] Normal flow is backlog -> context_ready -> in_development -> review -> done, with rework, closed and escalated paths.
- [ ] Planner handles context and planning; builder handles implementation, technical validation and concise docs; reviewer independently assesses evidence.
- [ ] Playtest outcome is separate from compile/test success; required human playtest remains pending until evidence is provided.
- [ ] Unity validation commands, executable/version, target platform and EditMode/PlayMode/build requirements are project settings rather than assumed defaults.
- [ ] User-supplied game-dev skills can be bound by role without searching for or installing any now.
- [ ] A controlled pilot and update are tested in a disposable Unity fixture before touching a real game project.

- [ ] Planner and reviewer default to gpt-6.2-sol/high; builder defaults to gpt-6.2-sol/medium, with Astra 6.2 high as an optional escalation.
- [ ] Visual Editor tasks may use an optional Terra 6.1 binding; no extra visual agent is required by the compact workflow.

## Model Implementation Plan

Use the approved Sol 6.2 baseline for all three roles. Preserve independent review and expose escalation through the adapter contract. Skill bindings and model settings remain separate project configuration.

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
