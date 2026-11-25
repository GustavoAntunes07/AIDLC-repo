---
id: INTENT-6xpb
title: Generate harness adapters and role model configuration
status: done
story_points: 5
retry_count: 1
branch: intent/6xpb-generate-harness-adapters-and-role-model-configuration
---

# Description

Define canonical role responsibilities and per-role model/reasoning settings, then render harness-specific files with ownership tracking.

## Dependencies

Recommended sequence dependencies: INTENT-6xe7, INTENT-6xhv, INTENT-6xlf.
See [the shared roadmap](../docs/aidlc-cli-roadmap.md). These are planning dependencies; the current CLI does not enforce dependency metadata.

# Acceptance Criteria

- [x] Codex and Claude adapters are explicit capabilities with independent integration checks.
- [x] sync is idempotent and preserves user instructions and local overrides.
- [x] Planner, builder and reviewer have independently configurable model identifiers and reasoning settings.
- [x] The adapter distinguishes generated configuration from actual execution; unsupported model switching is reported.
- [x] Model availability and runtime settings are verified on the target harness before claiming a successful model assignment, using the developer-authorized Codex Sol 6.1 validation scope below.
- [x] Review uses an independent context; an unavailable reviewer is a pending validation, never self-approval.

- [x] The approved baseline is Luna high for orchestrator/reader/documenter, Sol 6.2 high for planner and routine reviewer, and Sol 6.2 medium for builder/tester.
- [x] Astra 6.2 high is an explicit escalation for high-risk or inconclusive reviews, not a mandatory model for every intent.

## Model Implementation Plan

Generate role settings from project overrides over the approved baseline. Validate availability in the target harness. Keep routine review in an independent context and require explicit escalation to the specialist model. Terra 6.1 may be an optional visual/computer-use binding, not a required coding role.

## Context and technical plan

The developer authorized proceeding. This branch starts at `f45d404`, the accepted lifecycle implementation, which supplies the shared Core and preset behavior required here.

1. Use the packaged role instructions as the canonical source. Render native Codex TOML or Claude Code Markdown for the selected harness and retain the approved Codex defaults. Support native Claude model bindings and explicit model/reasoning overrides per role. Keep specialist review an explicit selection.
2. Integrate harness-specific paths with initialization, manifest validation, project diagnostics and updates. Keep historical Codex ownership and recovery compatible. A configured harness mismatch requires explicit resolution.
3. Add `sync --dry-run` and `sync` for managed adapter files. Report changes and conflicts, preserve user-owned settings and files, and reuse transactional rollback and recovery. A second sync of the same configuration is a no-op.
4. Report configured bindings separately from observed runtime evidence. Perform independent integration checks using each harness's native loading and runtime capabilities. Record unavailable access, unverified bindings, or unsupported switching as such. Review must run in independent context.

# Related Files

- `docs/aidlc-cli-roadmap.md`
- `scripts/aidlc.ts`
- `.aidlc/config.yaml`
- `AIDLC.md`
- `AGENTS.md`
- `tests/aidlc.test.ts`
- `packages/cli/index.ts`
- `packages/core/config.ts`
- `packages/core/compatibility.ts`
- `packages/core/init.ts`
- `packages/core/installation.ts`
- `packages/core/payload.ts`
- `packages/core/project.ts`
- `packages/core/transactions.ts`
- `packages/core/update.ts`
- `resources/codex/`
- `tests/bootstrap.test.ts`
- `tests/update.test.ts`

# Implementation Notes

- Added native Codex/TOML and Claude Code/Markdown generation from the packaged role definitions. Fresh init records the selected harness and preserves the user's surrounding instructions. Existing installations keep their original harness and historical Codex manifests remain readable.
- Added validated per-role project bindings, read-only task definitions and explicit specialist review selection. The default Codex binding stays Luna/Sol 6.2, with Astra 6.2 high available through explicit specialist selection. Claude defaults use its native Haiku, Sonnet and Opus aliases.
- `sync` previews or applies generated role changes through the existing conflict check, transaction backup, recovery and rollback. The install manifest remains the source of ownership for rollback. `update` uses the same role bindings.
- The adapter package is version `0.3.0`, retaining supported installation manifest schemas. A different harness can be selected on fresh installation. The command output keeps requested bindings separate from runtime observation.

# Test Notes

- The post-correction full suite passed 87 tests with 770 assertions on Windows (Bun 1.4.0, Node 24.11.1). The final targeted adapter suite passed 11 tests with 90 assertions after the single-quote correction. Coverage includes both renderers, safe sync and conflict handling, lifecycle commands, the packaged consumer, and rollback/recovery from historical installations. The setup check, doctor, branch verification and Git whitespace check passed. Doctor reports the existing framework checkout's legacy no-manifest warning.
- Claude Code 2.1.94 discovered all seven generated project agents and their model aliases in a fresh disposable Claude project, using `claude agents --setting-sources project`. Actual planner and reader probes both returned `Credit balance is too low`, leaving effective model and reasoning unverified.
- Codex CLI 0.159.2 did not list GPT-6.2 Sol or Astra in its local catalog. Its read-only Sol 6.2 probe returned `model_not_found` for the signed-in ChatGPT account. The approved model defaults remain in place and effective execution is pending verification on a supported target.

# Review Notes

- Independent preliminary review identified a P2 in the shared workflow text distributed to Claude projects. The packaged instructions now identify both native instruction files and describe the supported harnesses.
- Independent code review by `adapter_review` (reported runtime `gpt-6-astra`) approved the correction and scoped rollback ownership. Effective native model/effort verification remains pending for the constraints in Test Notes, and the developer's final acceptance is outstanding.

## Formal review cycle 1

REJECTED on 2026-11-24. Both findings were reproduced with disposable projects. A separate reviewer confirmed the version-boundary finding. Return to Builder for scoped corrections and regression tests.

- P2, `packages/core/installation.ts`: the adapter build and its predecessor both identify as `0.2.0`. A new project synced with a planner override accepts an `update --to 0.2.0` from the predecessor CLI. That update resets the managed agent to the baseline while retaining the override in YAML, and the current `doctor` reports success. Introduce a compatibility boundary the old CLI rejects and preserve supported upgrades and rollback. Add a mixed-version regression.
- P2, `packages/core/config.ts`: a YAML inline comment after an unquoted model value becomes part of the generated model identifier. `sync` writes the incorrect binding and `doctor` reports success. Parse or reject inline comments without damaging quoted scalars, and test both model and reasoning fields.

Effective model and effort verification remains pending under the runtime constraints recorded in Test Notes.

## Corrections for formal review cycle 1

- Bumped the local CLI/Core and package metadata to 0.3.0. The current CLI reads 0.1.0 and 0.2.0 manifests for upgrade and recovery. Older clients reject installations recorded as 0.3.0 before changing managed resources.
- Unquoted inline comments in model/reasoning overrides now fail before writes. Quoted hash characters remain literal. Comments can be placed on their own lines.
- Regression coverage exercises a real 0.2.0 CLI extracted from commit f45d404, upgrade with overrides, old-client refusal, rollback to the original manifest, and a repeated upgrade. Separate tests cover model/reasoning comments and both quoting styles.
- Validation passed 87 tests with 770 assertions across five files. After tightening single-quoted scalar validation, the targeted adapter suite passed 11 tests with 90 assertions, including trailing comments after both quote styles. Setup, doctor, branch and whitespace checks passed.
- APPROVED by the independent correction reviewer for both P2 fixes. The reviewer confirmed quoted hash characters and doubled single quotes remain intact. retry_count remains 1. Runtime model/effort acceptance remains pending, so this intent stays in review.

## Consolidated review decision

Code review APPROVED on 2026-11-24 based on independent review of both corrections and the recorded passing validation. No unresolved code findings remain. The compatibility boundary and quoted/unquoted scalar behavior were rechecked against the current files. Setup, doctor, branch and whitespace validation passed again.

Overall acceptance remains pending the unchecked effective model/runtime criterion. The prior native probes established unavailable Sol 6.2 access and insufficient Claude account credit. Status remains review until that criterion is verified or the developer explicitly changes its scope. retry_count remains 1.

## Authorized runtime validation

The developer authorized the available-model path using gpt-6.1-sol and explicitly deferred Sol 6.2 and Claude runtime checks. This narrows runtime acceptance for this delivery to the available Codex model without changing the packaged default bindings.

A disposable Codex project was initialized and synced with project overrides for planner (gpt-6.1-sol/high) and builder (gpt-6.1-sol/medium). Requested settings were read from `aidlc harness --role` and passed explicitly to separate read-only Codex CLI sessions with user configuration disabled. Both returned OK with successful turn completion and process exit 0. This verifies the explicit handoff using resolved overrides.

Native session `turn_context` records confirm the effective model and effort:

- Planner session `01a21087-dfdd-7f63-90ff-c2ea5e751169`: gpt-6.1-sol, high.
- Builder session `01a21088-0299-7cc2-a746-13c9b5a52189`: gpt-6.1-sol, medium.

Logs reside under `~/.codex/sessions/2026/11/24/`. Sol 6.2 and Claude remain unverified and are deferred under the developer's authorization. Setup, doctor, branch and whitespace checks passed. The existing independent code review approval applies. The intent is ready for final developer acceptance under standard governance.

# Commits
## Final developer acceptance

APPROVED by the developer, who explicitly authorized completion, commit, push and starting the next intent. Runtime acceptance uses the authorized Sol 6.1 scope described above. Sol 6.2 and Claude inference remain deferred.
