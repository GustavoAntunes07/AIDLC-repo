# AIDLC project workflow

Use `.aidlc/config.yaml` for workflow preset, governance and lifecycle policy, and `intents/` for units of work. Use `aidlc doctor` to validate installation and intent structure. Use `aidlc intent new "Title"` to create an intent, `aidlc intent list` to browse and `aidlc intent show <id>` to inspect one. Existing `aidlc new`, `list` and other lifecycle aliases remain available.

Read the selected harness instruction file (`AGENTS.md` for Codex or `CLAUDE.md` for Claude Code), this workflow and the assigned intent at the start of a task. Work on the intent branch and check it using `aidlc branch <intent-id>`. Use `aidlc transition <intent-id> <status>` for lifecycle changes. Stop at approval gates. Never commit, push or publish without explicit authorization. Record validation evidence before completion; do not approve your own implementation.

Default stages: context, planning, implementation, testing, review and documentation. Use a specialist reviewer for high-risk architecture, migrations or unresolved review questions when available and authorized.

The installer supports the default preset with Codex or Claude Code. The lifecycle Core also supports a generic compact-v1 preset; governance is configured independently. Unity Mini generation, Task Observer and multi-project management are separate capabilities. A compact project can select `workflow_preset: compact` under config version 1. If `intent_schema` is omitted, the preset selects compact-v1. A missing per-intent `schema` always means full-v1 for compatibility. Existing intents are not automatically converted; finish an active full-schema intent in the default preset or explicitly migrate it before continuing under compact when its status is unsupported.

The selected harness and its generated files are recorded in the installation manifest. Configure per-role model and effort overrides with `role_models.<role>.model` and `role_models.<role>.reasoning` in `.aidlc/config.yaml`. Codex uses native TOML with Luna for coordination, reading and documentation, Sol 6.2 for planner, builder, tester and routine reviewer, and Astra 6.2 for explicit specialist review. Claude Code uses native Markdown with Haiku, Sonnet and Opus for the corresponding roles. Verify availability and effective model settings with the target harness before claiming a binding executed.

Use `aidlc sync --dry-run` to review generated agent updates and `aidlc sync` to apply them. Sync uses managed-content checks, a transaction backup, recovery and rollback. It keeps user-owned configuration and text outside the managed instruction block and refuses edited or missing generated files. Repeating sync without configuration changes makes no writes.

Use `aidlc harness` to inspect configured bindings. `aidlc harness --role planner --model <id> --reasoning <effort>` renders one role definition for a separate task context. `aidlc harness --specialist` prepares an explicit reviewer specialist. The output reports `runtime: unverified`; confirm the model and effort in the newly started harness session. Run reviewers in an independent context. A model assignment alone does not create one, and an unavailable independent reviewer remains pending rather than authorizing self-approval.

## Updating this installation

Preview with `aidlc update --dry-run`. Apply an explicit bundled target with `aidlc update --to 0.3.0`. Review conflicts before proceeding. Updates preserve project configuration and state, create a local backup, and record the transaction ID. Recover an interrupted update with `aidlc update --recover <id>` or restore a completed installation with `aidlc rollback <id>`. Migration of installation metadata is part of the same transaction.
