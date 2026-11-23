---
id: INTENT-6xhv
title: Implement safe project updates and migrations
status: done
story_points: 5
retry_count: 1
branch: intent/6xhv-implement-safe-project-updates-and-migrations
---

# Description

Make installed projects maintainable before rolling the framework out to multiple projects. Define ownership and recoverability using the installation manifest.

## Dependencies

Recommended sequence dependencies: INTENT-6xe7.
See [the shared roadmap](../docs/aidlc-cli-roadmap.md). These are planning dependencies; the current CLI does not enforce dependency metadata.

# Acceptance Criteria

- [x] update --dry-run reports version changes and per-file actions without changing files.
- [x] Unmodified managed files update; locally modified managed files produce a conflict or staged merge instead of being overwritten.
- [x] User configuration, intents, decisions, context, observations and external skills survive update.
- [x] Updating from the last supported version is tested, including schema migration, interruption recovery and a second idempotent run.
- [x] A local backup and rollback path restores the prior managed installation and compatible metadata.
- [x] Targets are explicitly versioned and publication/network operations are separate from local update application.

## Technical Plan

The user authorized starting this intent under standard governance.

1. Deliver local CLI version 0.2.0 with explicitly supported installed releases 0.1.0 and 0.2.0. Validate known manifest versions/ownership paths; migrate installation manifest schema 1 to schema 2 with updateProtocol 1. Configuration schema and project state formats remain unchanged.
2. Share the canonical managed payload between init and update. Build a read-only per-file update plan against recorded baseline hashes, preserving user-owned files and text outside the AGENTS.md managed block. Any managed drift blocks the complete application before backups or writes.
3. Add update --dry-run and update --to 0.2.0. The target is bundled locally; this intent performs no registry fetch, package publication or automatic fleet update. migrate uses the same reviewed update/migration transaction.
4. Persist before/after managed parts and manifest metadata in a project-local backup with a journal and pending marker. Apply atomic file replacements, write the manifest last, and require recovery before further writes when interrupted.
5. Add rollback <transaction-id> and update --recover <transaction-id>. Preserve surrounding user instructions and user state; refuse rollback over unrelated managed edits or an active transaction. Recover a stale crashed-process lock only for the explicit matching transaction.
6. Test the real archived 0.1.0 package, dry-run byte preservation, conflict refusal, state/skill preservation, migration/idempotency, rollback, interruption after a real process exit and a packaged consumer command. Keep existing bootstrap/lifecycle regressions passing.
7. Update command/runtime documentation and leave the intent at final/manual review after implementation, tests and technical reassessment. Do not self-approve, commit, publish or alter real game projects.

# Related Files

- `docs/aidlc-cli-roadmap.md`
- `scripts/aidlc.ts`
- `.aidlc/config.yaml`
- `AIDLC.md`
- `AGENTS.md`
- `tests/aidlc.test.ts`
- `tests/update.test.ts`
- `packages/core/installation.ts`
- `packages/core/update.ts`
- `packages/core/transactions.ts`
- `packages/cli/index.ts`
- `README.md`

# Implementation Notes

- Released the private local package as 0.2.0. Update targets are bundled and explicitly selected; supported installed versions are 0.1.0 and 0.2.0.
- Added shared managed payload definitions, read-only per-file planning, drift conflicts and update/migrate CLI commands. Dry-run prints metadata/actions without exposing backup content or creating files.
- Migration upgrades installation manifest schema 1 to 2 with updateProtocol 1; config schema 1 and existing project state remain unchanged.
- Updates validate bounded ownership paths, preserve all user-owned state, and replace only managed content or the owned AGENTS.md block.
- Added persisted before/after snapshots, hashed journals, atomic file replacement, pending markers and update locks. Installation metadata is applied/restored last.
- Added explicit rollback/recovery with conflict preflight, stale-process lock handling and active-process protection. Recovery restores the prior installation; it does not forward-resume the operation.
- Archived the actual 0.1.0 tarball as a test fixture. Existing bootstrap tests target 0.2.0 and structurally modify manifest version fields instead of relying on schema-1 text replacement.
- Documented supported versions, commands, migration scope, backup ownership, process-interruption recovery and runtime/concurrency limitations. No package publication, global installation or real game-project update was performed.

# Test Notes

- Final `bun test`: 49 passed, 0 failed, 455 assertions across lifecycle, bootstrap/package and safe-update suites.
- Fifteen update scenarios use projects initialized by the real archived 0.1.0 CLI: read-only planning, explicit targets, conflict refusal, state preservation, manifest migration, idempotency, rollback, tampered ownership/backups, active locks and junction safety.
- Two scenarios terminate an actual child process with exit 73 after the first managed write or after installation metadata. Doctor and normal writers reject the pending installation; explicit recovery reclaims the dead process lock, restores the prior managed content/metadata and allows a later update.
- Packaged-consumer test packs/installs 0.2.0 offline, executes its installed command outside the checkout, upgrades a real 0.1.0 installation and rolls it back.
- Rollback preserves user edits outside the managed instruction block and subsequent user configuration edits. The restored installation passes doctor under both 0.2.0 and the old 0.1.0 CLI.
- `bun aidlc:doctor`, branch verification and `git diff --check` passed. The fixture exception in .gitignore allows retaining the real historical tarball.
- Runtime: Windows, Node 24.11.1, Bun 1.4.0. Other Node >=22/platform combinations remain pending CI coverage. Process-interruption recovery is tested; hardware/power-loss guarantees and concurrent-editor isolation are not claimed.

# Review Notes

Technical reassessment completed after validation: inspected managed-path bounds, snapshot/journal validation, ownership rules, conflict checks, metadata ordering, lock handling and rollback preservation. No unresolved actionable findings were identified in this assessment. A rollback pending-marker check is repeated under its lock to avoid replacing another transaction's recovery marker.

This assessment was performed in the implementation chat, not an independent reviewer context. No agent self-approval or done status is claimed. The standard profile allows automatic intermediate handoffs; final/manual developer review and completion approval remain pending.

## Code Review Cycle 1

REJECTED. One additional process-interruption window was reproduced beyond the 49 existing passing tests. No runtime implementation was modified during this review.

- [P2] `packages/core/transactions.ts:77-87`: runTransaction acquires the persistent update lock before running prepare or persisting the backup journal. If the process exits during prepare (reproduced with exit 73), the project has a stale lock but no journal/pending marker. A subsequent update is refused with an instruction to recover, but update --recover <id> calls rollback/readBackup and fails with ENOENT. Doctor incorrectly reports success because it checks only the pending marker. Managed content remains intact, but installed-project updates remain blocked without manual filesystem intervention.
- Required correction: model/diagnose the pre-journal interruption state and provide explicit safe cleanup/recovery of its matching dead-process lock. Verify project content is still at a recognized baseline before discarding an uncommitted preparation, and never remove a live or unrelated lock. Preserve full rollback for transactions that reached content writes.
- Required regression: terminate a real child process after lock acquisition and before journal persistence; doctor should expose the condition, supported recovery should finish without content loss, and a later normal update should succeed. Keep the existing post-write/manifest-write interruption tests.

Reproduction: a disposable project was initialized with the archived 0.1.0 CLI. A child invoked the existing transaction entry point and exited during prepare. Doctor returned 0; update --to 0.2.0 returned 1 for the stale lock; update --recover <id> returned 1 for a missing journal.json. The probe does not modify source implementation.

Decision: increment retry_count to 1 and return to in_development for this correction. No review approval or completion is recorded.

## Resolution of Review Cycle 1

The user authorized implementing the correction.

- Added shared lock inspection and process-liveness diagnostics. Doctor now reports abandoned preparations even when no pending marker or backup journal exists; normal CLI writes refuse a foreign/abandoned update lock.
- Journal-less explicit recovery requires the exact dead-process lock, a recognized manifest/config/state and every managed baseline hash matching. It refuses managed drift, active/unrelated locks and a pending marker whose journal is missing.
- Recovery rechecks the baseline while holding its replacement lock. It records a project-bound preparation recovery receipt, preserves partial preparation snapshots for inspection and is idempotent. A failed recheck/receipt write restores the original abandoned lock.
- Persistent locks are exclusively linked from a complete, flushed candidate record, avoiding an empty persistent lock if the process exits while writing the candidate. This requires filesystem hard-link support and fails safely before managed content writes if unsupported.
- Transactions with a journal continue using full rollback and the existing before/after content checks. Project state and text outside managed blocks remain preserved.
- Two selected regression tests failed against the previous implementation before the correction.
- Targeted update suite: 21 tests passed. Final full suite: 55 passed, 0 failed, 501 assertions, including bootstrap/lifecycle, real pre-journal process interruption, full post-write recovery and installed-package update/rollback.
- Six new scenarios cover diagnostic/recovery/idempotency, partial preparation snapshots, baseline drift refusal, active/unrelated locks, missing journals with pending markers and incompatible configuration.
- Doctor, branch verification and Git whitespace validation passed. Runtime/platform coverage and power-loss/concurrent-editor limitations remain as documented in README.

Correction reassessment: inspected the cleanup preconditions, complete-record lock publication, baseline checks and retained full-rollback branch; no additional actionable findings were identified in this reassessment. It took place in the implementation chat, not a separate reviewer context. No self-approval or completion is recorded; final/manual sign-off remains pending under standard governance. retry_count remains 1.

## Final Manual Acceptance

APPROVED by the developer on 2026-11-23. The developer explicitly replied "aprovado" to the request for final completion after receiving the correction summary and the result of 55 passing tests / 501 assertions. This is manual developer acceptance and authorization to conclude INTENT-6xhv, not an agent self-approval or authorization to commit, push or publish.

The pre-journal finding has a validated correction; retry_count remains 1 to preserve review history. The standard governance profile remains active.

# Commits
