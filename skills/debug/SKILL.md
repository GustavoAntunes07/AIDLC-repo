---
name: debug
description: Use when encountering a bug, test failure, flaky behavior, or unexpected result. Requires reproducible evidence, targeted instrumentation, AI-DLC branch/intent safeguards, and regression tests when code changes are made.
---

# Debug Skill

Hypothesis-driven debugging for AI-DLC repositories.

Announce at start:

```txt
Entering Debug Mode. I will reproduce, hypothesize, instrument, analyze, fix, and verify.
```

At the top of each response during this workflow, include:

```txt
[Current Phase: X]
```

---

## AI-DLC Rules

Project rules override this skill.

- Do not commit without explicit developer approval.
- Do not push without explicit developer approval.
- Do not run `git stash`, `git restore .`, `git reset`, or broad cleanup commands automatically.
- For implementation work, use an intent and verify the intent branch before editing.
- Preserve unrelated user changes in the working tree.
- If the request is read-only diagnosis, no intent is required.
- If the diagnosis turns into edits, tests, or persistent docs, move into the lifecycle unless the developer explicitly keeps it outside.

---

## The Loop

```txt
Phase 0: SAFETY      -> inspect git state, active intent, and branch
Phase 1: DISCOVER    -> scan tools, tests, recent changes, and runtime entry points
Phase 2: REPRODUCE   -> create or run the smallest failing reproduction
Phase 3: HYPOTHESIZE -> rank 3-5 theories with required evidence
Phase 4: INSTRUMENT  -> add temporary [DEBUG-MODE] logs only where needed
Phase 5: ANALYZE     -> capture logs to files and inspect targeted excerpts
Phase 6: CLEAN       -> remove only your temporary debug instrumentation
Phase 7: FIX         -> implement the root-cause fix
Phase 8: VERIFY      -> run regression and project validation commands
```

---

## Iron Laws

1. No fix without a reproduction or strong observed evidence.
2. No guessing when instrumentation or tests can answer the question.
3. Never start a long-running process in the foreground.
4. Never dump raw large logs into the conversation.
5. Never use broad Git cleanup to remove debug logs.
6. Never overwrite unrelated user work.

---

## Phase 0: Safety

Before touching code:

```bash
git status --short --branch
bun aidlc:status
```

If the work will edit files, confirm the target intent and run:

```bash
bun aidlc:branch <intent-id>
```

If the branch is wrong, stop and ask the developer before switching or creating a branch.

---

## Phase 1: Discovery

Inspect:

- Runner scripts: `package.json`, `Makefile`, `Taskfile`, `docker-compose.yml`
- Test framework and existing test patterns
- Suspect files and their callers
- Recent relevant history with `git log --oneline -10 -- <path>`
- Runtime requirements such as env vars, services, or databases

Summarize only what matters for reproducing the bug.

---

## Phase 2: Reproduce

A bug you cannot reproduce is a bug you can only guess about.

Prefer, in order:

1. Existing failing test or command
2. Focused unit/integration test
3. Standalone repro script
4. HTTP/curl reproduction for API bugs
5. Looping command for flaky behavior
6. Manual reproduction steps as a last resort

Temporary repro files are allowed, but keep them uncommitted unless the developer explicitly approves a commit. Delete temporary repro files before finishing unless they are promoted to permanent regression tests.

---

## Phase 3: Hypothesize

Generate 3-5 ranked hypotheses:

```txt
H1: short name
  Theory: what may be wrong
  Evidence needed: what would prove or disprove it
  Likely files: where to inspect or instrument
```

Investigate the most likely hypothesis first.

---

## Phase 4: Instrument

Add temporary debug logs only at decision points needed to prove or disprove a hypothesis.

Log format:

```txt
[DEBUG-MODE][H1-short-name][functionName] key=value
```

Good places to instrument:

- Function entry and inputs
- Branches taken
- External calls
- State mutations
- Return values

Keep a list of every file you instrumented.

---

## Phase 5: Analyze

Capture logs to files and inspect only targeted slices:

```bash
node repro.js > debug.log 2>&1
rg '\[DEBUG-MODE\]' debug.log
rg '\[DEBUG-MODE\]\[H1' debug.log
```

Never let unbounded logs flood stdout.

For each hypothesis:

```txt
H1 analysis:
  Expected:
  Actual:
  Verdict: confirmed | refuted | inconclusive
  Evidence:
```

---

## Phase 6: Clean

Before implementing the final fix, remove only your own temporary instrumentation and logs.

```bash
rg -n '\[DEBUG-MODE\]' .
```

Edit the specific files, then verify:

```bash
rg -n '\[DEBUG-MODE\]' .
```

Do not use `git restore .`, `git reset`, or `git checkout --` unless the developer explicitly asks for that operation.

---

## Phase 7: Fix

Fix the root cause, not the symptom.

- Keep the change minimal.
- Do not mix a refactor into the bugfix unless it is necessary.
- Add or keep a regression test when practical.
- Update Test Notes if this is inside an AI-DLC intent.

---

## Phase 8: Verify

Run:

- The focused reproduction/regression test
- The relevant test suite
- The project validation commands

If red/green proof is needed, use the safest available comparison. Do not stash or revert user work automatically just to prove the red state.

---

## Server Safety

Never run a long-lived server command in the foreground.

Use a detached process and clean it up:

```bash
nohup npm run dev > server.log 2>&1 &
SERVER_PID=$!
sleep 3

# run reproduction

kill $SERVER_PID 2>/dev/null
```

---

## Final Output

Report:

- Reproduction used
- Root cause
- Fix summary
- Regression coverage
- Validation commands and results
- Any residual risk

If a commit would be useful, provide a commit message suggestion only. Do not commit unless explicitly approved.
