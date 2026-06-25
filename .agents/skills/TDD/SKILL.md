---
name: tdd
description: >
  Use this skill whenever the user wants to write code following Test-Driven Development practices. Trigger on prompts like "write tests first", "let's do TDD", "red-green-refactor", "test-first approach", "add tests before implementing", or any time the user is about to implement a feature or fix a bug and wants tests to drive the code. Also trigger when the user explicitly says they want to follow TDD, asks how to structure a feature with tests, or when they want to validate behavior incrementally before writing production code. Do NOT trigger for requests to add tests to already-written code — that is a retrofitting task, not TDD.
---

# TDD Skill

Guides the full Red-Green-Refactor cycle: write a failing test, write the minimum code to pass it, then refactor — repeating until the feature is complete.

---

## The Cycle

Always follow this loop, one small increment at a time:

```
🔴 RED    → Write a failing test for the next small behavior
🟢 GREEN  → Write the minimum code to make it pass (no more)
🔵 REFACTOR → Clean up without breaking the tests
```

Never skip phases. Never write production code before a failing test exists.

---

## How to run this skill

### Step 1 — Understand the target behavior
Before writing any test, clarify what the unit of behavior is. If the user gives a vague task ("implement auth"), break it into testable increments:
- "user with valid credentials receives a token"
- "user with wrong password gets a 401"
- "expired token is rejected"

List the increments upfront. Let the user confirm or adjust before proceeding.

### Step 2 — RED: Write the first failing test
Write a single, focused test for the smallest increment. The test must:
- Have a descriptive name that reads like a sentence (`should return 401 when password is wrong`)
- Follow the **Arrange / Act / Assert** structure (add comments if helpful)
- Test behavior, not implementation details
- Fail right now (no production code exists yet)

Show the test and confirm it would fail. Briefly explain why it's failing.

### Step 3 — GREEN: Write the minimum passing code
Write only what's needed to make that one test pass. No extras, no "while I'm here" logic. Ugly is fine at this stage — correctness is the goal.

Show the code. Confirm all tests pass (the new one and any existing ones).

### Step 4 — REFACTOR: Clean without breaking
Look for duplication, poor naming, or structural issues in both test and production code. Refactor one thing at a time. After each change, confirm tests still pass.

If nothing needs cleaning, say so explicitly — don't refactor for the sake of it.

### Step 5 — Loop
Return to Step 2 for the next increment. Repeat until all increments are covered.

---

## Output format per cycle

Structure each cycle clearly:

```
### 🔴 RED — [behavior being tested]
[test code]
Why it fails: [one sentence]

### 🟢 GREEN
[production code]
Tests passing: ✅

### 🔵 REFACTOR
[changes made, or "Nothing to refactor here."]
Tests still passing: ✅
```

---

## Guidelines

- **One behavior per test.** If a test has two assertions testing different things, split it.
- **Name tests as specs.** `should reject expired tokens` beats `test_token_3`.
- **No mocking by default** unless I/O or external services are involved. Prefer real objects.
- **Keep production code honest.** Don't write code that only works for the test input (hardcoding return values to pass a test is a smell — push to the next increment).
- **Match the project's test framework.** Read existing test files before choosing a framework. Default to Jest (TS/JS) or Pytest (Python) if none exists.
- **Pause before big refactors.** If a refactor would touch many files, describe the plan first and wait for confirmation.

---

## Example trigger phrases

- "Let's do TDD for the login feature"
- "Write the tests first, then we implement"
- "Red-green-refactor this"
- "I want to build this test-first"
- "How would TDD look for this use case?"