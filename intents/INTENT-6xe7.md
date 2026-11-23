---
id: INTENT-6xe7
title: Extract shared core and bootstrap installable CLI
status: done
story_points: 5
retry_count: 1
branch: intent/6xe7-extract-shared-core-and-bootstrap-installable-cli
---

# Description

Extract reusable configuration, validation and project discovery from scripts/aidlc.ts. Add a package entry point and init/config/doctor commands. Keep existing repositories and legacy commands working during adoption.

## Dependencies

Recommended sequence dependencies: Roadmap review and approval.
See [the shared roadmap](../docs/aidlc-cli-roadmap.md). These are planning dependencies; the current CLI does not enforce dependency metadata.

# Acceptance Criteria

- [x] A built package installs into a temporary location and exposes aidlc outside the framework checkout.
- [x] init installs into a fresh repo and an existing repo without overwriting existing user files; rerunning is idempotent.
- [x] Configuration separates workflow preset, governance and harness; schema and installed framework versions are distinct.
- [x] A per-project install manifest records managed paths, baseline hashes, component versions and selected preset/adapters.
- [x] doctor runs read-only and diagnoses missing, incompatible or modified components; legacy tests remain passing.
- [x] Windows and paths containing spaces are covered; package contents and supported runtime are documented.

- [x] The user-requested standard governance is active locally and agent handoffs honor configured gates instead of asking after every stage.

## Technical Plan

1. Establish `packages/core`, `packages/cli` and packaged resources with explicit project-root arguments. Core operations return structured results; only the CLI sets exit codes and prints output.
2. Extract setup/config/validation first, preserving the current schema and public legacy commands. Keep `scripts/aidlc.ts` as a compatibility entry point while extraction proceeds.
3. Add package metadata, a build command and an `aidlc` executable. Prefer JavaScript targeting Node for consumers and keep Bun for development/tests; confirm supported Node versions and packaged resource resolution during implementation.
4. Define versioned installation metadata and ownership boundaries before writing init. Record installed component versions, baseline content hashes and user-owned paths.
5. Implement default-preset init/config/doctor with Codex resource generation as the initial adapter seam. Preserve existing files, write managed instructions only in owned blocks or referenced auxiliary files, and refuse ambiguous conflicts. Unity Mini installation remains a later intent.
6. Validate the built package as a consumer in temporary directories, including Windows paths with spaces, empty/existing repositories, repeated init, existing instructions, unknown schemas and incompatible manifests.
7. Retain passing legacy lifecycle tests and record the target runtime/package contract. Do not publish packages or install into game projects in this intent.

The user approved starting development. Implementation generates the approved model baseline for new installations; runtime model dispatch remains a later adapter capability.

# Related Files

- `docs/aidlc-cli-roadmap.md`
- `scripts/aidlc.ts`
- `.aidlc/config.yaml`
- `AIDLC.md`
- `AGENTS.md`
- `tests/aidlc.test.ts`

# Implementation Notes

- Extracted shared configuration, intent validation, installation manifest and read-only project inspection into `packages/core`.
- Added packaged CLI commands and a legacy dispatcher, preserving existing package scripts and lifecycle behavior.
- Built dependency-free Node ESM with Bun; package resources include the default workflow and seven Codex definitions using the accepted model baseline.
- Init preflights conflicts, preserves user documents, appends an owned instruction block, refuses junction/symlink write paths and records managed hashes in an installation manifest.
- The manifest separates framework/component version 0.1.0, config schema 1 and legacy state version 1.0.0.
- No package publication, global installation, runtime model dispatch, game project modification or third-party skill installation was performed.

## User Requested Governance Change

The user authorized continuing the review and removing per-stage approvals. This intent now also switches the framework checkout to standard governance. Agent instructions in the checkout and packaged resources follow configured gates; the final documentation stage asks before transitioning to done. New installations still choose their own profile, defaulting to strict unless explicitly configured.

# Test Notes

- `bun test`: 23 passed, 0 failed (9 legacy and 14 bootstrap/package scenarios; 96 assertions).
- Tests build the Node bundle, pack/install the tarball offline in a temporary consumer, execute its installed npm command, and run init/doctor outside the framework checkout.
- Covered existing documents and game content, idempotent init, managed conflicts/drift, unknown schema/options, invalid governance/branch settings, directory and junction conflicts, missing intent directories and manifest path traversal.
- `bun aidlc:doctor`, `bun aidlc:branch INTENT-6xe7`, `git diff --check` and built Node CLI help passed.
- Tested on Windows with Node 24.11.1 and Bun 1.4.0. Declared consumer baseline is Node >=22; a CI matrix for other versions/platforms remains a limitation.
- Doctor warns that this framework checkout is a legacy/no-manifest installation. It was intentionally not adopted by init.

## Authorized Tester Stage

The user explicitly authorized proceeding with tests. The tester stage reran the full suite against the current branch without changing implementation code:

- `bun test`: 23 passed, 0 failed, 96 assertions; 9 legacy and 14 bootstrap scenarios.
- Package build, offline tarball install and installed npm command execution outside the checkout passed as part of that suite.
- `bun aidlc:validate`, `bun aidlc:doctor`, `bun aidlc:branch INTENT-6xe7` and `git diff --check` passed.
- `node dist/aidlc.js --version` returned `0.1.0`.
- Whitespace checks also covered untracked source, resource, test and planning files.
- The no-manifest warning for the legacy framework checkout is expected; adoption remains outside this intent.
- Runtime coverage remains Windows/Node 24.11.1; other Node versions/platforms were not tested.

Tester outcome: PASS for the defined bootstrap acceptance criteria. Proceed to the review gate; no code-review approval or done status is implied.

## Corrections Following Review Cycle 1

The user explicitly authorized resolving both findings.

- P1: preflight now validates existing AGENTS.md bytes as UTF-8 and rejects NUL-containing instructions. UTF-16LE/BE, invalid UTF-8 and tested UTF-16 without a BOM fail before any project content is written. Existing UTF-8/BOM content is appended to without rewriting its original bytes.
- P2: a shared read-only compatibility check validates configuration, project state and installation-manifest/component versions before legacy dispatch. This also prevents read-oriented legacy commands from creating directories under an unsupported schema. Supported legacy/no-manifest projects and initial setup remain functional.
- Regression verification before fixes: 8 selected cases failed against the previous implementation.
- Full verification after fixes: `bun test` passed 33 tests, 0 failures and 312 assertions (9 original lifecycle and 24 bootstrap/package cases).
- Added coverage for encoding refusal, exact UTF-8 BOM/accent/line-ending preservation, incompatible config/manifest/framework/component/state versions, unchanged existing intents, missing-directory non-creation and writable supported legacy projects.
- The suite rebuilt the bundle and tested offline tarball installation plus its installed npm command outside the checkout.
- `bun aidlc:doctor`, `bun aidlc:validate`, `bun aidlc:branch INTENT-6xe7` and `git diff --check` passed.
- Review-cycle counter stays at 1; corrections are ready for the next tester/reviewer stages, without assigning a review decision to the new implementation.

## Standard Governance Validation

- Active local governance changed from strict to standard at the user's explicit request. Approval gates remain before implementation and at final completion/closure; tests, review and documentation have no added intermediate handoff confirmations.
- Twelve role instructions in the checkout and packaged resources now consult active configured gates. The documentation role obtains the final approval before transitioning to done. All fourteen agent TOML files parse correctly.
- The strict test fixture is explicit instead of inheriting the developer checkout's selected profile. An integration scenario verifies that standard skips review/approved gates while retaining the done gate.
- `bun test`: 34 passed, 0 failed, 318 assertions, including the encoding/compatibility regressions and offline consumer-package installation.
- `bun aidlc:doctor`, branch verification and `git diff --check` passed. The expected legacy/no-manifest warning remains documented.

# Review Notes

REJECTED — first code-review cycle. The original 23 passing tests do not cover the two reproduced cases below. No implementation code was changed during this review.

- [P1] `packages/core/init.ts:65`: an existing UTF-16LE/BOM AGENTS.md is decoded as UTF-8 and rewritten, corrupting the original instructions. Reproduction: init exits 0, original bytes are lost, and doctor exits 0. Preserve the original encoding/bytes, or reject unsupported input encoding in preflight before any content writes. Add a regression test with a UTF-16 input file.
- [P2] `packages/cli/index.ts:74-75`: compatible-command dispatch calls the legacy writer without configuration/installation compatibility validation. Reproduction: set config version to 99 in a temporary initialized project; doctor exits 1 but new exits 0 and creates an intent. Add a shared compatibility preflight for mutating commands, preserving supported legacy/no-manifest use, and verify failure without any project writes for unsupported schema/component versions.

Decision: return to in_development, increment retry_count to 1, and request approval for the correction stage under strict governance. Review approval and done status remain withheld.


Correction reassessment: both previously reproduced findings are addressed by the current implementation and regression coverage. UTF-8 validation runs in preflight before content writes; supported instruction bytes are appended to rather than rewritten. Legacy dispatch runs the shared compatibility check before commands can create directories or alter intents. The current code, corresponding regression tests and profile handoff changes were inspected; no additional actionable findings were identified in this reassessment.

The earlier rejection describes the previous implementation. This reassessment does not claim an independent reviewer context and does not self-approve implementation. The intent remains at review for the developer's final/manual sign-off. retry_count remains 1.

## Final Manual Approval

APPROVED by the developer on 2026-11-23. The developer explicitly replied "Aprovado" to the request for final completion after being informed that the reassessment had no independent reviewer context. This is the developer's manual review/acceptance and final completion authorization, not an agent self-approval or approval to commit, push or publish.

Both prior findings are resolved with regression coverage. Final validated implementation: 34 passing tests, 0 failures and 318 assertions. Documentation and local standard governance are synchronized. retry_count remains 1 to preserve the rejected review cycle.

# Commits
