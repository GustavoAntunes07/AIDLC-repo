# AIDLC

A development lifecycle for coding agents, evolving from a repository template into an installable CLI and shared Core. The local package is version `0.4.0` and supports native Codex and Claude Code agent definitions, compact workflows and a project-scoped Task Observer.

## Build and install locally

Contributors use Bun 1.4 or later to build and test. The installed package uses Node.js 22 or later and has no runtime npm dependencies. This delivery was exercised on Windows with Bun 1.4.0 and Node 26.13.1; other supported Node versions still need CI coverage.

```powershell
bun install
bun run build
bun test
npm pack
npm install --global ./aidlc-0.4.0.tgz
```

The package remains private; releases are local artifacts pending manual acceptance. `npm pack` builds a local tarball; it does not publish a release. Do not use an unverified registry package with the same name.

From a consumer project, run:

```powershell
aidlc init --preset default --harness codex --governance standard
aidlc doctor
aidlc config
```

For Claude Code, create the installation with `aidlc init --preset default --harness claude`. The selected harness is recorded in the installation manifest and cannot be switched by running `init` again.

Or target an explicit directory:

```powershell
aidlc --cwd "C:\projects\my game" init
```

`init` targets exactly the current directory or `--cwd`, not an inferred parent repository. Governance defaults to `strict`. Supported governance choices are `strict`, `standard` and `autonomous`; the available installation preset is `default` and supported harnesses are `codex` and `claude`. The lifecycle Core also supports a generic compact intent preset for projects configured explicitly.

## Ownership and diagnostics

Initialization preflights conflicts, preserves existing `AIDLC.md`, appends a delimited AIDLC block to the selected harness instruction file (`AGENTS.md` for Codex or `CLAUDE.md` for Claude Code), and refuses to overwrite preexisting generated files or configuration. A valid repeated `init` makes no file changes. An existing AIDLC repository without a manifest requires future explicit adoption; it is not silently converted.

An existing harness instruction file must be valid UTF-8, with an optional UTF-8 BOM. Initialization checks its encoding before writing project content and appends the managed block without rewriting the original bytes. UTF-16, invalid UTF-8 and NUL-containing instructions are refused with a conversion message; the original file remains untouched.

`.aidlc/install.json` records installation schema, framework/component versions, the selected harness, managed paths, content hashes and user-owned state. Configuration schema version and installed framework version are separate. Configuration, intents, context, observations and external skills are user-owned; generated resources are managed. User edits outside the delimited instruction block do not count as managed drift.

`doctor` is read-only. It reports missing files, unsupported schema/components, malformed configuration and modified managed content. Managed drift blocks update application until the conflict is resolved; it is not overwritten automatically. A legacy project gets a no-manifest warning. User configuration changes that remain valid are allowed; `init` does not change an existing project's governance.

Initialization uses a project lock. On a preflight conflict, no project content is changed. A filesystem failure after writes begin may leave a partial installation; the error lists created files. Inspect them before retrying. Interrupted-init recovery and legacy-template adoption remain separate future work. Installed-package updates and installation-metadata migration use the transaction commands below.

## Commands and compatibility

Commands include `init`, `config`, `doctor`, `update`, `migrate`, `rollback`, `--version` and `--help`. Lifecycle commands are available in the modern `intent` family (`intent new`, `intent list`, `intent show`, `intent transition`) and through existing `new`, `status`, `list`, `next`, `validate`, `branch`, `transition` and `close` aliases. Both use the same explicit-project-root Core rules. The source compatibility entry point is still `bun scripts/aidlc.ts` and existing package scripts are preserved.

Legacy command dispatch validates configuration, state and installation-manifest compatibility before any command can write files or create directories. Recognized legacy projects without a manifest remain supported. Only `setup` can start without configuration; commands such as `new` require initialized configuration. Unsupported schema or component versions must be handled by a compatible CLI or explicit migration.

Core configuration parsing, intent validation, lifecycle operations, installation and diagnostics accept an explicit project root and return data. CLI layers handle command formatting and process exit codes.

### Workflow presets and intent schemas

Configuration schema version remains `1`. An omitted `workflow_preset` means `default`; `intent_schema` may be omitted or set to `full-v1` for default. The compact Core workflow can be selected explicitly for an existing project with:

```yaml
version: 1
workflow_preset: compact
governance_profile: standard
```

The optional `intent_schema: compact-v1` makes the selection explicit. If omitted, compact selects `compact-v1`; mismatched or unknown selectors are errors. Presets define the intent fields, required roles, lifecycle states and evidence checks. Governance remains independently selected. Where compact configuration omits role, transition or approval-gate sections, the compact preset supplies its defaults.

Configuration uses block mappings and block lists. Scalar values or inline arrays in structural sections such as `lifecycle.transitions` and `agents.required` are rejected rather than silently ignored.

New compact intents use `id`, `title`, `type` (`feature`, `bug` or `experiment`), `status` and `branch`, with Objective, Scope, Acceptance Criteria, Plan, Validation and Review sections. They do not require story points or retry counts. A missing per-intent `schema` field always means legacy `full-v1`, even in a compact project. Existing intents are preserved without automatic conversion. Historical terminal intents remain readable; an active full-schema intent in a state unavailable in compact must be finished under the default preset or explicitly migrated before continuing in compact.

The installer supports `init --preset default --harness codex|claude`. The compact intent preset can be configured explicitly. Unity Mini remains planned.

## Safe updates and rollback

This CLI bundles exactly target `0.4.0` and supports installed releases `0.1.0`, `0.2.0`, `0.3.0` and `0.4.0`. Updating the CLI package and upgrading each project's installed resources are separate operations. Nothing is fetched from a registry by these commands.

```powershell
aidlc update --dry-run
aidlc update --to 0.4.0
aidlc rollback <transaction-id> --dry-run
aidlc rollback <transaction-id>
```

Dry-run prints source/target versions, migrations and per-path actions without writing files or creating a lock. Application requires an explicit target. A locally modified or missing managed file blocks the complete application before any backup or content write. Edits outside the selected harness instruction block remain user-owned.

The upgrade migrates installation manifest schema 1 to schema 2, adding update protocol 1 and backup ownership. Configuration schema stays at 1 and project state stays at its existing format. `aidlc migrate --to 0.4.0` runs this same bundled update/migration transaction; it is not a generic arbitrary-schema migrator. The framework checkout's legacy template has no manifest and is not implicitly adopted.

Application creates `.aidlc/backups/<transaction-id>/snapshot.json` and a journal before changing managed content. The snapshot contains before/after managed parts and installation metadata; it does not copy configuration, intents, context, observations, decisions, assets or external skills. Content is atomically replaced and installation metadata is written last. Successful application prints the transaction ID; repeating the same update is a no-op.

If a process exits partway through application, doctor reports the pending transaction and normal project writes are blocked. Restore the previous installation with:

```powershell
aidlc update --recover <transaction-id>
```

Recovery uses rollback, not forward resume. It tolerates a mix of old and new managed parts, preserves current text outside owned instruction blocks, and refuses unrelated managed edits. It can reclaim a dead process's matching lock only when the transaction is explicitly selected; a live lock is never stolen. Rollback itself is recoverable through the same pending marker. Backups are bound to the canonical project path; move a project back to that path before recovering its backup.

Doctor also diagnoses a process that exited while preparing an update, before its journal existed. For that state, the same explicit `update --recover <transaction-id>` command validates the installed manifest, configuration/state compatibility and every managed baseline hash before releasing the matching dead-process lock. It refuses local managed drift, unsupported versions, active/unrelated locks, or a pending marker without its required journal. Existing partial preparation snapshots are preserved; recovery records a small receipt and can be repeated without changes. Transactions with a journal continue through the full rollback path.

Update locks are published as complete records using an exclusive hard link, so interruption while writing a candidate cannot expose an empty persistent lock. The project filesystem must support hard links; an unsupported filesystem fails before managed-content writes. Preparation recovery rechecks the baseline under its acquired lock and retains the abandoned lock if that recheck or the receipt write fails.

Rollback restores prior managed content and manifest, including the prior schema, while leaving user-owned files and subsequent configuration edits intact. It refuses corrupted backups, unknown paths and conflicting managed edits. Backups/journals remain for inspection. This release supports process-interruption recovery; it does not claim filesystem/hardware power-loss guarantees or concurrent-editor transactional isolation. Avoid editing managed content while an update is running.

Tests include historical package upgrades, abrupt child-process exits before and after installation metadata, idempotency, rollback conflicts and a consumer installed from the 0.4.0 tarball. This delivery was validated on Windows with Bun 1.4.0 and Node 26.13.1; the wider Node >=22/platform matrix remains pending CI coverage.

## Project-scoped Task Observer

The Observer is opt-in through `observer.enabled: true` in `.aidlc/config.yaml`; it is disabled by default. It provides session-guided capture for useful corrections, repeated workflows, tool limitations and skill gaps. Codex and Claude automatic activation hooks are unavailable in this release. A manually reported session checkpoint records that the CLI command ran; it does not prove automatic activation or continuous observation.

Capture and proposal records live under `.aidlc/observations/` in the project. They are preserved as user data by framework updates. Capture reuses the active coding session and does not start another model call per tool. See [Task Observer commands, record formats and safeguards](resources/task-observer.md).

## Harness adapters and models

New installations generate these Codex definitions:

| Role | Model | Reasoning |
|---|---|---|
| Orchestrator and Reader | `gpt-6-luna` | `high` |
| Planner | `gpt-6.2-sol` | `high` |
| Builder and Tester | `gpt-6.2-sol` | `medium` |
| Routine Reviewer | `gpt-6.2-sol` | `high` |
| Documenter | `gpt-6-luna` | `high` |

The workflow reserves `gpt-6.2-astra` at `high` for high-risk or unresolved review questions. It does not generate an always-running specialist agent or automatically switch models. Claude Code uses native agent Markdown under `.claude/agents/`, with Haiku for orchestration, reading and documentation, Sonnet for planning, implementation, tests and routine review, and Opus for explicit specialist review. Project role overrides live in the user-owned `.aidlc/config.yaml`:

```yaml
role_models:
  planner:
    model: "opus"
    reasoning: "high"
```

Use `aidlc sync --dry-run` to preview changes to generated role files and `aidlc sync` to apply them. Sync is idempotent, preserves user configuration, intents, local instruction text and external skills, and reports conflicts for edited or missing managed files. It uses the transaction backup and rollback path shared with updates. Because project configuration is user-owned, sync reads the valid role overrides currently saved there. Use `aidlc update --dry-run` and the explicit `aidlc update --to 0.4.0` to update framework resources.

`aidlc harness` prints requested role bindings and their agent paths. Use `--role planner` to inspect one role or `--specialist` to prepare an explicit specialist reviewer definition. Add `--model <id>` and `--reasoning <effort>` to render an override for a separate task context. The command reports runtime as `unverified`. Use the target harness's model catalog and effective session settings to verify model availability and execution. Codex CLI 0.159.2 rejected Sol 6.2 with the account used for validation. Claude Code 2.1.94 discovered all seven generated roles, and its runtime probe stopped at the account credit limit.

Run review in an independent context. Selecting a reviewer model does not establish an independent context, and an unavailable reviewer remains pending instead of self-approving.

## Next milestones

The roadmap lives at `docs/aidlc-cli-roadmap.md` in the source repository. Local safe updates/migrations, shared lifecycle with generic compact schema support, and harness adapters are complete. Task Observer implementation is in progress; Unity Mini, context/resume and multi-project inventory remain planned. Unity skills will be supplied separately by the user. No game project or global skill installation is modified by this bootstrap.

Version 0.3.0 records the adapter compatibility boundary; version 0.4.0 adds the Task Observer. CLIs older than 0.3.0 reject adapter installations, and older CLIs reject 0.4.0 installations. Upgrade older installations with this CLI before using sync. Role model values support quoted strings. Put YAML comments on their own lines. Inline comments after unquoted role model values are rejected before writes.

Runtime validation used project overrides resolved by `aidlc harness` and explicitly passed to separate read-only Codex CLI sessions. Native session logs confirmed gpt-6.1-sol with high and medium effort, and both sessions completed successfully. Sol 6.2 and Claude inference remain deferred.
