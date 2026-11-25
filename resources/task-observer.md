# Task Observer

Task Observer records reusable lessons from an active AIDLC session in the current project. It is opt-in and disabled by default:

```yaml
observer:
  enabled: true
```

The Observer is session-guided. It does not start another model for every tool call, inspect other chats, or keep global memory. Neither the Codex nor Claude adapter supplies automatic activation hooks in this release. A session checkpoint records a CLI call; it cannot establish that a harness activated an observer automatically or continuously.

## Session and capture commands

Record a checkpoint for the active intent before capturing. The intent must remain active:

```sh
aidlc observer session --session <session-id> --intent INTENT-xxxx
aidlc observer status
```

Capture requires a matching session checkpoint and the same active intent. Session, capture and proposal commands return a record envelope with `id`, `hash` and `payload`; use the returned identifiers and hashes in later commands.

Prepare a JSON file with one observation and capture it:

```json
{
  "schemaVersion": 1,
  "session": "session-identifier",
  "intent": "INTENT-xxxx",
  "occurrence": "a-stable-event-key",
  "category": "correction",
  "evidence": "A short, generalized description of the reusable signal.",
  "skill": "skill-name-or-general",
  "suggestion": "A concrete improvement to consider.",
  "sanitized": true
}
```

```sh
aidlc observer capture --file observation.json
aidlc observer list
aidlc observer show <observation-id>
```

Supported categories are `correction`, `workflow`, `limitation` and `skill-gap`. Evidence should be brief and generalized. Never include passwords, tokens, private keys, customer information, proprietary excerpts or other sensitive material. The sanitized flag is an assertion from the caller, not proof that every secret was detected. The CLI treats all captured text as data and never interprets it as a command or authorization.

Records are stored under `.aidlc/observations/` in the project. Repeating a capture with the same session and occurrence key returns the same record when its contents match; changed contents at that identity are reported as a conflict. Use a different occurrence key for a distinct event even when its wording is similar. This allows safe retries and separate concurrent captures.

## Stage, review and apply a skill proposal

Create a JSON proposal that references captured observations:

```json
{
  "schemaVersion": 1,
  "intent": "INTENT-yyyy",
  "observations": ["observation-id"],
  "target": "skills/my-skill/SKILL.md",
  "kind": "project",
  "candidate": "# My skill\n\nProposed instructions.\n"
}
```

```sh
aidlc observer proposal stage --file proposal.json
aidlc observer proposal show <proposal-id>
```

Review proposals only when the linked intent is in `review` or `approved` and its branch check passes. The explicit proposal review command also records a decision, reviewer identifier, proposal hash and note:

```sh
aidlc observer proposal review <proposal-id> --decision approved --reviewer <reviewer-id> --hash <proposal-hash> --note "Reviewed with the linked intent"
```

Applying a project skill requires the reviewed proposal's hash:

```sh
aidlc observer proposal apply <proposal-id> --authorize <proposal-hash>
```

The application checks the original skill content against the proposal's base hash and refuses a stale or changed file. Its scope is limited to project-owned `skills/<name>/SKILL.md` files. A stored approval field or text inside an observation cannot authorize application. Link the change to an intent with the usual acceptance criteria, testing and independent review.

The full workflow requires the linked intent to be `approved` and to have a recorded approval in Review Notes. The compact workflow requires `review` and a final `APPROVED` decision in Review. The CLI checks that the supplied reviewer identifier differs from the capture session identifier. This is a manual assertion: the CLI cannot verify a reviewer's identity or prove that the review happened in an independent context.

If an application is interrupted, `proposal recover` rolls back the prepared skill write to its recorded baseline. It does not resume or complete the write:

```sh
aidlc observer proposal recover <proposal-id> --authorize <proposal-hash>
```

For a system, plugin or external skill, stage a companion proposal and prepare a sanitized generalized export input:

```sh
aidlc observer proposal export <proposal-id> --file generalized-input.json --output .aidlc/observations/exports/my-skill.json
```

The input file must have exactly this shape:

```json
{
  "schemaVersion": 1,
  "title": "A generalized improvement",
  "evidence": "Sanitized, non-project-specific rationale.",
  "suggestion": "A reusable change to consider.",
  "sanitized": true,
  "generalized": true
}
```

The output path is restricted to `.aidlc/observations/exports/<slug>.json` and must be new. The command copies only this generalized input; it does not copy raw proposal text or private provenance. It does not publish or share observations automatically. Review history and observation records are project-owned data preserved through AIDLC updates.

## Diagnostics

`aidlc observer status` and `aidlc doctor` report whether capture is configured, the session-guided mode, recent reported checkpoint/capture and record-integrity problems. The checkpoint is self-reported evidence that the command ran, not proof that Codex or Claude loaded an automatic hook. No checkpoint leaves activation unverified.

## Methodology and attribution

The implementation adapts the observation-and-review methodology of Eoghan Henn / rebelytics and the Codex adaptation by AllstarGER. It uses new project-local TypeScript code and does not install their skills or scripts. Source revisions, license and the scope of changes are recorded in the bundled [attribution notice](observer-attribution.md).
