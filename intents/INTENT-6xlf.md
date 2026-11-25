---
id: INTENT-6xlf
title: Expose intent lifecycle and configurable workflow presets
status: done
story_points: 5
retry_count: 2
branch: intent/6xlf-expose-intent-lifecycle-and-configurable-workflow-presets
---

# Description

Move intent, branch and governance logic into the shared core. Separate full and compact intent schemas while preserving old identifiers and statuses.

## Dependencies

Recommended sequence dependencies: INTENT-6xe7, INTENT-6xhv.
See [the shared roadmap](../docs/aidlc-cli-roadmap.md). These are planning dependencies; the current CLI does not enforce dependency metadata.

# Acceptance Criteria

- [x] intent new/list/show, status, branch and intent transition use the same core as legacy commands.
- [x] Workflow presets define required roles, intent fields and allowed transitions independently of governance.
- [x] default preserves the existing lifecycle; a compact schema supports five normal states and closed/escalated escape paths.
- [x] Readiness, completion evidence, branch checks and approval gates are enforced for each preset.
- [x] Invalid or unsupported preset/schema combinations fail clearly instead of silently falling back.
- [x] Migration preserves existing intents and terminal statuses.

# Related Files

- `docs/aidlc-cli-roadmap.md`
- `scripts/aidlc.ts`
- `.aidlc/config.yaml`
- `AIDLC.md`
- `AGENTS.md`
- `tests/aidlc.test.ts`
- `packages/core/config.ts`
- `packages/core/project.ts`
- `packages/core/compatibility.ts`
- `packages/core/intents.ts`
- `packages/cli/index.ts`
- `packages/cli/legacy.ts`
- `tests/lifecycle.test.ts`
- `tests/bootstrap.test.ts`
- `resources/workflow.md`
- `README.md`

## Context and authorization

On 2026-11-23 the developer requested proceeding with pending intents after the PR #3 correction. This starts the next implementation intent in the accepted roadmap, based on the tested PR head including INTENT-98yh. Dependencies INTENT-6xe7 and INTENT-6xhv are done. The older roadmap-only INTENT-3ozh remains unchanged.

Reader stage completed: lifecycle currently uses cwd-relative CLI helpers, while config, installation compatibility and project diagnostics are already shared Core modules. Preserve existing identifiers, terminal intent records and legacy CLI output; consolidate the rules behind explicit-root APIs. Compact Core support is distinct from the later Unity Mini installation, adapter and playtest integrations.

## Technical Plan

1. Extract explicit-root lifecycle operations into Core, returning data/errors rather than changing cwd, logging or exiting. Both CLI command families delegate to these operations.
2. Keep configuration version 1 and omitted preset compatible with default. Add default/compact preset definitions for roles, fields, transitions and evidence. Optional config `intent_schema: full-v1|compact-v1` must match preset; optional intent `schema` defaults to legacy full-v1 independently of project preset.
3. Compact uses backlog/context_ready/in_development/review/done plus closed/escalated, roles planner/builder/reviewer, and id/title/type/status/branch with Objective, Scope, Acceptance Criteria, Plan, Validation and Review. Full records retain their existing fields and sections.
4. Add intent new/list/show/transition while preserving legacy commands and output. Readiness, evidence/completion, terminal protection, branch checks and configured governance gates share Core rules.
5. Preserve existing IDs/files/terminal statuses without automatic conversion. Under compact, full active records in unsupported states get a clear finish-or-migrate diagnostic instead of status remapping. init remains default/Codex until the later preset/adapter deliveries; document an explicit compact configuration example for Core use.
6. Add behavior tests for both interfaces and schemas, malformed configuration, no-write failures, read-only discovery and legacy migration preservation. Run full tests, installed consumer checks, doctor and independent review. Leave final completion for developer acceptance; commit/push require separate authorization.

# Implementation Notes

- Builder extracted explicit-root intent creation/discovery/show/status/branch/transitions/close and schema-aware validation into shared Core operations. Both CLI families delegate to the same implementation without changing process cwd.
- Added default/compact preset definitions, explicit schema selection checks, required-role and transition bounds, preset defaults independent of governance, and read-only discovery. Writes validate project compatibility and intent paths before mutation.
- Preserved legacy full intent records and terminal statuses. Active states excluded by compact report a finish-under-default/explicit-migration diagnostic; no files are automatically converted. The existing installation migration transaction remains unchanged.
- Compact generation omits full bookkeeping, carries type/schema metadata and uses compact readiness/evidence sections. Completion reads the latest explicit review decision while preserving earlier rejection history.
- No release, adapter, Unity integration, commit or push is part of this implementation stage.
- Review cycle 1 corrections use literal callback replacements for metadata/close reasons and reject unsupported scalar/inline shapes on known configuration mapping/list paths. Both targeted regressions now pass; final full validation and reassessment follow.
- Review cycle 2 correction validates the modern command's nonblank title after consuming options; legacy bare new retains its Untitled default. The invalid-arguments regression passes.

# Test Notes

- Initial Tester stage: full suite passed outside the sandbox (75 tests, 665 assertions); the sandbox's two directory-junction EPERM failures passed on the approved rerun. Setup, doctor, branch and whitespace checks passed. Runtime: Windows, Bun 1.4.0, Node 26.13.1.
- Independent review subsequently found an uncovered metadata replacement bug. A permanent regression with literal dollar tokens in an intent title reproduced corrupted frontmatter after transition. Additional malformed config shape regressions are added for the review correction. Final validation must be rerun after both fixes.
- Final Tester validation after both review cycles: `bun test` passed 76 tests, 0 failures, 686 assertions across four files on Windows/Bun 1.4.0/Node 26.13.1. Includes explicit-root Core, modern/legacy parity, both schemas and governance matrices, metadata/config/title regressions, installed package use, real 0.1.0 migration and rollback. Junction tests executed outside the sandbox. No Linux execution is claimed.
- Final `bun aidlc:check`, `bun aidlc:doctor`, `bun aidlc:branch INTENT-6xlf` and `git diff --check` passed. Build ran successfully through test setup. Doctor reports only the existing framework-checkout no-manifest warning; no lint command is configured.

# Review Notes

## Review cycle 1

REJECTED by separate reviewer agent review_lifecycle on 2026-11-23; retry_count incremented to 1.

- P2: Whole-frontmatter String.replace treats dollar tokens in titles and close reasons as replacement syntax, corrupting literal data. Use callback replacements and verify status/close round trips preserve those bytes.
- P2: Known configuration mapping/list keys accept and discard unsupported scalar/inline forms, yielding silently empty graphs or fallback roles. Reject unsupported shapes clearly before writes; verify doctor/config and mutation commands fail.

Return to Builder for these scoped corrections, then rerun Tester and independent Reviewer. No approval, completion, commit or push is recorded.

## Review cycle 2

REJECTED for a remaining CLI boundary issue confirmed by independent reviewer: modern `intent new` with an empty title or only `--type bug` falls through to the legacy Untitled fallback. These calls must reject without writes, while legacy bare `new` keeps its compatibility default. The new regression reproduces the failure. Cycle 1 corrections passed the full suite (76 tests, 683 assertions), but final acceptance requires this additional correction and validation. retry_count is 2.

## Final independent review

APPROVED by separate reviewer agent review_lifecycle on 2026-11-23. All three findings are resolved and no actionable findings remain. The reviewer inspected the literal metadata replacements, strict configuration shape checks and post-option modern title validation, and accepted the final Tester evidence of 76 tests/686 assertions. Linux remains unexecuted. retry_count stays 2 to preserve review history.

Documentation now describes the modern commands, compact configuration/schema and compatibility boundaries.

## Final manual acceptance

APPROVED by the developer on 2026-11-23: "approved, lets proceed" in response to the explicit request for final completion and commit/push. This authorizes concluding INTENT-6xlf, committing/pushing its reviewed changes, and starting the next roadmap intent INTENT-6xpb. It does not authorize a merge or package publication.

# Commits
