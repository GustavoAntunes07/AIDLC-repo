---
id: INTENT-6xt7
title: Integrate project-scoped Task Observer with staged skill improvements
status: done
story_points: 5
retry_count: 1
branch: intent/6xt7-integrate-project-scoped-task-observer-with-staged-skill-improvements
---

# Description

Implement an optional observer capability shared by the full and compact workflows. Adapt the upstream methodology behind the core/adapters rather than silently installing a third-party global skill.

## Dependencies

Recommended sequence dependencies: INTENT-6xe7, INTENT-6xhv, INTENT-6xlf, INTENT-6xpb.
See [the shared roadmap](../docs/aidlc-cli-roadmap.md). These are planning dependencies; the current CLI does not enforce dependency metadata.

# Acceptance Criteria

- [x] Observations include an identifier, date, intent/session source, sanitized evidence, target skill, proposal and review status.
- [x] Logs are project-local by default; sharing or promoting a generalized observation is explicit.
- [x] Concurrent append, duplicates and resumed sessions are handled without lost observations.
- [x] Observation text is treated as data and cannot authorize commands, change governance or install skills.
- [x] Skill changes are staged with a diff and applied only within user-authorized scope; system/plugin skills are not overwritten.
- [x] doctor reports observer activation and last observed session; unavailable activation hooks are reported honestly.
- [x] Update/migration preserves observations and review history; upstream license, attribution and chosen source revision are recorded.

- [x] The observer reuses the active session for capture instead of requiring a separate model call per tool invocation; routine consolidation may use Luna high and proposed skill changes receive normal review.

## Model Implementation Plan

Keep observation capture lightweight and project-local; explicit skill update proposals follow the configured planner/builder/reviewer model policy rather than bypassing review.

## Context and stage authorization

Reader and Planner completed on 2026-11-25. This intent follows the accepted adapter delivery at `a542e19`; its dependencies are done. The developer requested resuming work from the published adapter branch. The next-intent branch has been created and verified with `bun aidlc:branch INTENT-6xt7`.

The resumed checkout contained unpublished local work based on the earlier commit. It was preserved in a named Git stash before a fast-forward to the published adapter delivery; none of that work was reapplied or discarded.

The active `standard` profile requires developer approval before implementation (`in_development`) and final completion (`done`). On 2026-11-25 the developer explicitly approved this technical plan ("Pode seguir"). The intent branch was verified again and the CLI transitioned to `in_development`. No commit, push or rollout to consumer projects is authorized by this approval.

## Reader findings

- CLI routing is in `packages/cli/index.ts`; `inspectProject` in `packages/core/project.ts` supplies doctor diagnostics.
- Configuration parsing and validation are explicit in `packages/core/config.ts`. Harness-native generation is shared through `packages/core/harness.ts` and packaged workflow instructions.
- `USER_PATHS` already preserves `.aidlc/observations/` and `skills/`. Observer data must remain outside the managed-file allowlist and update snapshots. Existing update tests exercise preservation of observations and external skills.
- Compatibility guards and recoverable transactions already protect installation updates. Observer writes need their own bounded atomic publication and proposal recovery without broadening framework ownership.

## Technical Plan

1. Add strict opt-in `observer.enabled`, defaulting to false, and an offline `session-guided` capability shared by full and compact workflows. Distributed instructions ask the active session to capture relevant corrections and repeated workflows. No daemon, global memory, transcript scraper, native automatic hooks or extra model calls are introduced.
2. Add `aidlc observer status`, `session --session <id> --intent <id>`, `capture --file <json>`, `list` and `show <id>`. Add `proposal stage --file <json>`, `proposal show <id>`, review and explicit application commands. Validate command options and JSON schemas before writes. Queries remain available when capture is disabled.
3. Store versioned immutable observation, checkpoint, proposal and review records under `.aidlc/observations/`. Observations include ID, UTC date, source intent/session, occurrence key, category, sanitized evidence, target skill, suggestion and review state. Derive occurrence identity from session plus occurrence key: identical retry returns the existing record; a changed payload at the same identity is a conflict. Identical descriptions at different occurrence keys remain distinct events.
4. Publish complete records exclusively and atomically after writing and syncing temporary files. Avoid read-modify-write aggregate logs. Preserve distinct concurrent writes, reject inconsistent same-ID writes, and ignore incomplete temporary records. Use ordered review events and explicit lock/recovery where proposal application requires serialization. Do not silently take over stale locks.
5. Treat all observation text as untrusted data. Enforce bounded fields, known keys and safe paths, require an explicit sanitized-evidence declaration, and reject recognizable credentials/private keys. Document the limits of automated redaction. Never execute commands, change governance, install skills or infer authorization from logged text or input approval fields.
6. Stage immutable proposals containing observation references, target, base hash, candidate content/hash and a reviewable diff. Link actual skill changes to an intent and its normal governance/review. Allow explicit application only to project-owned `skills/<name>/SKILL.md`, bound to the exact reviewed proposal hash, with base revalidation, safe-path checks and recoverable writes. Refuse stale bases and symlinks/junctions. External, system and plugin skills receive companion proposals or explicit sanitized exports; their originals are not overwritten. Sharing never reads other projects or publishes automatically.
7. Extend doctor with configured enablement, `session-guided` mode, last reported checkpoint/session, last capture and integrity errors. Report Codex and Claude automatic hooks as unavailable in this delivery. A manually reported checkpoint proves a CLI call, not automatic activation or continuous execution; no checkpoint means activity remains unverified.
8. Preserve observations, proposals and review history through update, sync, migration and rollback. Introduce the proposed `0.4.0` compatibility boundary while supporting historical `0.1.0`, `0.2.0` and `0.3.0` installations. Earlier CLIs must reject the new installed version before changing managed files. Do not add observer data or project skills to managed ownership.
9. Implement the Core in TypeScript and adapt methodology only. Include attribution, pinned revisions, CC BY 4.0 notices/license for adapted material, and a description of local changes. Do not install upstream scripts or adopt their global-memory policy.
10. Validate disposable packaged consumers, both harness instruction variants and both workflow presets; then run project checks and an independent review. Keep missing runtime activation evidence explicitly pending. Update implementation/test/review notes and lifecycle status after each completed stage; request final acceptance at the configured gate.

## Methodology provenance

- Original: Eoghan Henn / rebelytics, [One Skill to Rule Them All](https://github.com/rebelytics/one-skill-to-rule-them-all/tree/49d3c488af6311963e18e1a4fd9c309ff3c61b80), source revision `49d3c488af6311963e18e1a4fd9c309ff3c61b80`.
- Codex adaptation: AllstarGER, [source revision](https://github.com/AllstarGER/one-skill-to-rule-them-all/tree/764d8ebea9c74c669eb8e0e98051300d499efbc9), `764d8ebea9c74c669eb8e0e98051300d499efbc9`.
- Both declare CC BY 4.0. Attribution and license preservation are requirements for any adapted material; the planned implementation uses project-local storage rather than the adaptation's global memory. References were inspected as source material, not installed or activated as session skills.

# Related Files

- `docs/aidlc-cli-roadmap.md`
- `scripts/aidlc.ts`
- `.aidlc/config.yaml`
- `AIDLC.md`
- `AGENTS.md`
- `tests/aidlc.test.ts`
- `packages/cli/index.ts`
- `packages/core/config.ts`
- `packages/core/project.ts`
- `packages/core/harness.ts`
- `packages/core/installation.ts`
- `packages/core/compatibility.ts`
- `packages/core/update.ts`
- `packages/core/transactions.ts`
- `packages/core/observer.ts`
- `resources/workflow.md`
- `tests/observer.test.ts`
- `tests/observer-consumer.test.ts`
- `resources/task-observer.md`
- `resources/observer-attribution.md`
- `resources/CC-BY-4.0.txt`
- `tests/bootstrap.test.ts`
- `tests/harness.test.ts`
- `tests/lifecycle.test.ts`
- `tests/update.test.ts`
- `package.json`
- `package-lock.json`
- `README.md`

# Implementation Notes

Builder stage completed on 2026-11-25 on the verified intent branch:

- Added strict opt-in observer configuration, CLI commands and read-only doctor diagnostics. The default remains disabled; both harnesses report automatic hooks as unavailable and checkpoints as manual evidence.
- Implemented immutable atomic observation/session/proposal publication, occurrence-key deduplication and conflict detection, bounded schemas, sanitized-evidence declarations and credential screening. Records are local to `.aidlc/observations/` and do not execute their contents.
- Added proposal diffs, ordered review events, exact-hash authorization and linked-intent/branch checks for project skill changes. Application validates the baseline and uses a separate recoverable journal. Companion proposals cannot overwrite external skills; exports require explicit generalized sanitized input and an exclusive local destination.
- Kept observer data outside framework ownership. The 0.4.0 package accepts historical 0.1.0/0.2.0/0.3.0 installations while older CLIs refuse its installation manifest.
- Updated bundled workflow and usage documentation, with pinned source attribution and the CC BY 4.0 text distributed in package resources. No upstream skill or global memory was installed.
- Build, setup and doctor passed. Disposable probes confirmed companion lock-only recovery and cleanup of an abandoned lock after a completed skill application. Subsequent Tester results and independent implementation review are recorded below.
- Documenter completed the final documentation sync after review approval. The roadmap records the tested delivery as awaiting developer acceptance, and the package includes the usage guide, pinned attribution and license. No implementation work remains before the final acceptance gate.

# Test Notes

Planned behavior checks: disabled/enabled configuration; invalid input without writes; concurrent capture by separate processes; identical retry, conflicting retry and resumed sessions; interruptions around record publication; incomplete temporaries; review history ordering; unsafe paths and links; malicious observed text with no side effects; proposal diff and exact-hash authorization; stale-base refusal; recoverable skill application; protected external skills; generalized export without automatic publication; accurate activation diagnostics; preservation through update/rollback and mixed-version refusal; packaged consumers on both harnesses and default/compact workflows.

Planning-stage validation on 2026-11-25 passed setup, doctor, all-intent validation, intent branch verification and whitespace checks before implementation. The CLI transitioned `backlog -> context_ready` and later followed the authorized implementation/testing/rework stages.

Final Tester validation completed on 2026-11-25 using Bun 1.4.0 and Node 26.13.1 on Windows:

- `bun test`: 112 passed, 0 failed, 971 assertions across 7 files (54.55 seconds). The full run used elevated execution so strict junction tests ran rather than being skipped. A preceding run exposed a missing test-only `readdirSync` import; adding that import resolved its sole failure, and the complete suite was repeated successfully.
- Coverage includes both harnesses and both workflow presets, actual child-process exits before/after skill writes, idempotent recovery, exact UTF-8 size boundaries, serialized record limits, quoted-credential export refusal, concurrent capture, stale bases, linked targets, generalized export, installed package resources, historical version refusal and byte preservation of real observer/review records through update/sync/rollback.
- `bun run build`, `bun aidlc:check`, `bun aidlc:doctor`, `bun aidlc:validate`, `bun aidlc:branch INTENT-6xt7` and `git diff --check` passed. Doctor retains the known legacy-checkout warning (no installation manifest). The framework checkout's observer remains disabled; only disposable projects were activated for tests.
- The two independent-review regressions were demonstrated failing before their scoped corrections, then passed. Automatic activation hooks are deliberately unavailable in this delivery and are not claimed as runtime-verified.

# Review Notes

Independent review decisions, corrections and final developer acceptance are recorded below.

Reader and Planner completed their independent context/plan stages. The developer subsequently authorized implementation. Code review was performed by the separate `observer_review` context, independently of implementation.

## Independent review correction cycle 1

REJECTED on 2026-11-25 pending reproduced P2 corrections. The independent reviewer found that staged candidates used a 100,000-character bound while live skill reads used a 100,000-byte bound. A multibyte candidate could therefore be applied but become unreadable during interrupted-application recovery. The regression failed on the original implementation (expected stage refusal, received success). The work returned to Builder for consistent byte limits and regression validation.

The same review cycle also reproduced a P2 in generalized export: scanning the JSON-serialized input escaped quoted credential-like assignments and bypassed the raw-field filter used by capture. Its regression failed before the correction. Export now scans the raw fields before serialization; the focused export regression passes.

Builder corrections use a shared 100,000-byte UTF-8 limit for candidates, stored baselines and live skills, and reject records above the reader's 1 MiB envelope limit before publication. Regression checks pass for oversized multibyte rejection, exact-byte-boundary crash/recovery and JSON-expanded record rejection.

## Consolidated independent review decision

APPROVED on 2026-11-25 by the independent `observer_review` context after inspecting both corrections and the final delta, and receiving the complete passing validation evidence. No unresolved code findings remain. The reviewer confirmed the approved ownership/authorization boundaries, honest activation reporting and regression coverage. retry_count remains 1. This approves the implementation; it does not supply the developer's final completion, commit or push authorization.

## Final developer acceptance

APPROVED by the developer on 2026-11-25 ("aprovado"), explicitly accepting the completed delivery and authorizing the transition from `approved` to `done`. All acceptance criteria, validation, independent review and documentation stages are complete. This acceptance does not authorize commit, push, package publication or rollout to consumer projects.

# Commits

On 2026-11-25, after final acceptance, the developer explicitly authorized committing and pushing this delivery and opening a consolidated pull request to `main` containing all pending lifecycle, adapter and Observer changes. Merge and package publication remain separate actions.
