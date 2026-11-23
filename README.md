# AIDLC

A development lifecycle for coding agents, evolving from a repository template into an installable CLI and shared Core. The local package is version `0.2.0` and supports the default workflow with Codex definitions.

## Build and install locally

Contributors use Bun 1.4 or later to build and test. The installed package uses Node.js 22 or later and has no runtime npm dependencies. This change was exercised on Windows with Node 24.11.1; other supported Node versions still need CI coverage.

```powershell
bun install
bun run build
bun test
npm pack
npm install --global ./aidlc-0.2.0.tgz
```

The package remains private; releases are local artifacts pending manual acceptance. `npm pack` builds a local tarball; it does not publish a release. Do not use an unverified registry package with the same name.

From a consumer project, run:

```powershell
aidlc init --preset default --harness codex --governance standard
aidlc doctor
aidlc config
```

Or target an explicit directory:

```powershell
aidlc --cwd "C:\projects\my game" init
```

`init` targets exactly the current directory or `--cwd`, not an inferred parent repository. Governance defaults to `strict`. Supported governance choices are `strict`, `standard` and `autonomous`; only `default` and `codex` are supported as preset and harness in this bootstrap.

## Ownership and diagnostics

Initialization preflights conflicts, preserves existing `AIDLC.md`, appends a delimited AIDLC block to `AGENTS.md`, and refuses to overwrite preexisting generated files or configuration. A valid repeated `init` makes no file changes. An existing AIDLC repository without a manifest requires future explicit adoption; it is not silently converted.

Existing `AGENTS.md` must be valid UTF-8, with an optional UTF-8 BOM. Initialization checks its encoding before writing project content and appends the managed block without rewriting the original bytes. UTF-16, invalid UTF-8 and NUL-containing instructions are refused with a conversion message; the original file remains untouched.

`.aidlc/install.json` records installation schema, framework/component versions, managed paths, content hashes and user-owned state. Configuration schema version and installed framework version are separate. Configuration, intents, context, observations and external skills are user-owned; generated resources are managed. User edits outside the delimited `AGENTS.md` block do not count as managed drift.

`doctor` is read-only. It reports missing files, unsupported schema/components, malformed configuration and modified managed content. Managed drift blocks update application until the conflict is resolved; it is not overwritten automatically. A legacy project gets a no-manifest warning. User configuration changes that remain valid are allowed; `init` does not change an existing project's governance.

Initialization uses a project lock. On a preflight conflict, no project content is changed. A filesystem failure after writes begin may leave a partial installation; the error lists created files. Inspect them before retrying. Interrupted-init recovery and legacy-template adoption remain separate future work. Installed-package updates and installation-metadata migration use the transaction commands below.

## Commands and compatibility

Commands include `init`, `config`, `doctor`, `update`, `migrate`, `rollback`, `--version` and `--help`. Existing `setup`, `check-setup`, `new`, `status`, `list`, `next`, `validate`, `branch`, `transition` and `close` remain available. The source compatibility entry point is still `bun scripts/aidlc.ts` and existing package scripts are preserved.

Legacy command dispatch validates configuration, state and installation-manifest compatibility before any command can write files or create directories. Recognized legacy projects without a manifest remain supported. Only `setup` can start without configuration; commands such as `new` require initialized configuration. Unsupported schema or component versions must be handled by a compatible CLI or explicit migration.

Core configuration parsing, intent validation, installation and diagnostics accept an explicit project root and return data. Legacy lifecycle command dispatch remains at the CLI boundary; its later extraction and modern intent subcommands are separate work.

## Safe updates and rollback

This CLI bundles exactly target `0.2.0` and supports installed releases `0.1.0` and `0.2.0`. Updating the CLI package and upgrading each project's installed resources are separate operations. Nothing is fetched from a registry by these commands.

```powershell
aidlc update --dry-run
aidlc update --to 0.2.0
aidlc rollback <transaction-id> --dry-run
aidlc rollback <transaction-id>
```

Dry-run prints source/target versions, migrations and per-path actions without writing files or creating a lock. Application requires an explicit target. A locally modified or missing managed file blocks the complete application before any backup or content write. Edits outside the AGENTS.md managed block remain user-owned.

The upgrade migrates installation manifest schema 1 to schema 2, adding update protocol 1 and backup ownership. Configuration schema stays at 1 and project state stays at its existing format. `aidlc migrate --to 0.2.0` runs this same bundled update/migration transaction; it is not a generic arbitrary-schema migrator. The framework checkout's legacy template has no manifest and is not implicitly adopted.

Application creates `.aidlc/backups/<transaction-id>/snapshot.json` and a journal before changing managed content. The snapshot contains before/after managed parts and installation metadata; it does not copy configuration, intents, context, observations, decisions, assets or external skills. Content is atomically replaced and installation metadata is written last. Successful application prints the transaction ID; repeating the same update is a no-op.

If a process exits partway through application, doctor reports the pending transaction and normal project writes are blocked. Restore the previous installation with:

```powershell
aidlc update --recover <transaction-id>
```

Recovery uses rollback, not forward resume. It tolerates a mix of old and new managed parts, preserves current text outside owned instruction blocks, and refuses unrelated managed edits. It can reclaim a dead process's matching lock only when the transaction is explicitly selected; a live lock is never stolen. Rollback itself is recoverable through the same pending marker. Backups are bound to the canonical project path; move a project back to that path before recovering its backup.

Doctor also diagnoses a process that exited while preparing an update, before its journal existed. For that state, the same explicit `update --recover <transaction-id>` command validates the installed manifest, configuration/state compatibility and every managed baseline hash before releasing the matching dead-process lock. It refuses local managed drift, unsupported versions, active/unrelated locks, or a pending marker without its required journal. Existing partial preparation snapshots are preserved; recovery records a small receipt and can be repeated without changes. Transactions with a journal continue through the full rollback path.

Update locks are published as complete records using an exclusive hard link, so interruption while writing a candidate cannot expose an empty persistent lock. The project filesystem must support hard links; an unsupported filesystem fails before managed-content writes. Preparation recovery rechecks the baseline under its acquired lock and retains the abandoned lock if that recheck or the receipt write fails.

Rollback restores prior managed content and manifest, including the prior schema, while leaving user-owned files and subsequent configuration edits intact. It refuses corrupted backups, unknown paths and conflicting managed edits. Backups/journals remain for inspection. This release supports process-interruption recovery; it does not claim filesystem/hardware power-loss guarantees or concurrent-editor transactional isolation. Avoid editing managed content while an update is running.

Tests include the actual archived 0.1.0 package, abrupt child-process exits before and after installation metadata, idempotency, rollback conflicts and a consumer installed from the 0.2.0 tarball. Windows/Node 24.11.1 is the validated runtime; the wider Node >=22/platform matrix remains pending CI coverage.

## Models

New installations generate these Codex definitions:

| Role | Model | Reasoning |
|---|---|---|
| Orchestrator and Reader | `gpt-6-luna` | `high` |
| Planner | `gpt-6.2-sol` | `high` |
| Builder and Tester | `gpt-6.2-sol` | `medium` |
| Routine Reviewer | `gpt-6.2-sol` | `high` |
| Documenter | `gpt-6-luna` | `high` |

The workflow reserves `gpt-6.2-astra` at `high` for high-risk or unresolved review questions. It does not generate an always-running specialist agent or automatically switch models. Existing definitions in the framework checkout are not modified by package initialization tests. Generated files express intended configuration, not evidence that a particular model executed work. Runtime dispatch, model overrides and availability checks belong to the adapter intent.

## Next milestones

The roadmap lives at `docs/aidlc-cli-roadmap.md` in the source repository. Local safe updates/migrations are implemented for review. Next are configurable lifecycle presets, adapters, Task Observer, Unity Mini, context/resume and multi-project inventory. Unity skills will be supplied separately by the user. No game project or global skill installation is modified by this bootstrap.
