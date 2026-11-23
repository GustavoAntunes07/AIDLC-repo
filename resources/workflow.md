# AIDLC project workflow

Use `.aidlc/config.yaml` for workflow preset, governance and lifecycle policy, and `intents/` for units of work. Use `aidlc doctor` to validate installation and intent structure. Use `aidlc intent new "Title"` to create an intent, `aidlc intent list` to browse and `aidlc intent show <id>` to inspect one. Existing `aidlc new`, `list` and other lifecycle aliases remain available.

Read AGENTS.md, this workflow and the assigned intent at the start of a task. Work on the intent branch and check it using `aidlc branch <intent-id>`. Use `aidlc transition <intent-id> <status>` for lifecycle changes. Stop at approval gates. Never commit, push or publish without explicit authorization. Record validation evidence before completion; do not approve your own implementation.

Default stages: context, planning, implementation, testing, review and documentation. Model assignments are configuration, not proof of the model executing a task. Planner uses Sol 6.2 high, Builder/Tester use Sol 6.2 medium, and routine Reviewer uses Sol 6.2 high in an independent context. Luna high handles coordination, focused reading and documentation. Escalate high-risk architecture, migrations or unresolved review questions to Astra 6.2 high when available and authorized; it is not required for every intent.

The installer supports the default preset and Codex. The lifecycle Core supports default full-v1 intents and a generic compact-v1 preset; governance is configured independently. Unity Mini generation, Task Observer, harness adapters, automatic model dispatch and multi-project management are separate capabilities. A compact project can select `workflow_preset: compact` under config version 1. If `intent_schema` is omitted, the preset selects compact-v1. A missing per-intent `schema` always means full-v1 for compatibility. Existing intents are not automatically converted; finish an active full-schema intent in the default preset or explicitly migrate it before continuing under compact when its status is unsupported.

## Updating this installation

Preview with `aidlc update --dry-run`. Apply an explicit bundled target with `aidlc update --to 0.2.0`. Review conflicts before proceeding. Updates preserve project configuration and state, create a local backup, and record the transaction ID. Recover an interrupted update with `aidlc update --recover <id>` or restore a completed installation with `aidlc rollback <id>`. Migration of installation metadata is part of the same transaction.
