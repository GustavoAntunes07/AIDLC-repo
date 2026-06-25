---
name: brainstorming
description: >
  Use this skill whenever the user wants to think through a problem before writing code, explore different ways to implement a feature, compare architectural approaches, stress-test a plan, or generate and rank ideas. Trigger on prompts like "what's the best way to...", "I'm thinking about...", "help me decide between...", "what are my options for...", "how should I approach...", "brainstorm ideas for...", "grill me on this", "stress-test my plan", or any time the user is at a decision point before or during development. Also trigger when the user is stuck and needs to explore alternatives — even if they don't use the word "brainstorm". Do NOT wait for an explicit request; if the intent is exploration, decision-making, or plan validation, use this skill.
---

# Brainstorming Skill

Combines idea generation with relentless questioning — exploring options, grilling the user on each decision branch, and refining toward a clear recommendation. Runs as an iterative loop, not a one-shot answer.

---

## The Loop

This skill operates in repeating cycles, not a single pass:

```
🔭 EXPLORE  → Generate options for the current decision node
❓ GRILL    → Ask the sharpest question that resolves the next branch
⭐ REFINE   → Incorporate the answer, narrow the options, repeat
```

Continue the loop until the design space is fully resolved — all major branches answered, dependencies settled, recommendation locked.

---

## How to run this skill

### Step 1 — Orient
Before generating anything, understand the scope. Read relevant files if the user references the codebase. If the question is abstract, state your working assumption briefly:
> "Treating this as a greenfield decision — let me know if I should factor in the existing code."

### Step 2 — EXPLORE: Generate the first set of options
Produce a ranked list of 3–5 options for the top-level decision. For each option:

```
## Option N — [Short Name]
[1–2 sentence description]
**Why it works**: [strengths in this context]
**Trade-offs**: [costs, risks, limitations]
**Best when**: [the condition that makes this the right pick]
```

### Step 3 — GRILL: Ask the next decision-forcing question
Immediately after the options, ask the single most important question that would change which option wins. This is not a clarifying question — it's a question that resolves a branch of the decision tree.

Format:
```
❓ [Sharp, specific question about the design]
→ My recommendation: [your answer + one-sentence justification]
```

Always provide your recommended answer. Don't ask and leave the user hanging.

### Step 4 — REFINE: Incorporate and loop
When the user answers, update the option ranking based on what you now know. Eliminate options that no longer fit. Deepen the ones that survive. Then go back to Step 3 with the next unresolved branch.

Keep looping until:
- All major branches are resolved
- One option has clearly won out
- You can deliver a locked recommendation with full rationale

### Step 5 — Lock the recommendation
End the loop with a final summary:

```
## ⭐ Final Recommendation

Go with **[Option Name]** because [concise justification anchored in the decisions made during the session].

Key decisions that led here:
- [decision 1 and why it mattered]
- [decision 2 and why it mattered]

Watch out for: [the main risk or assumption that could invalidate this]
```

---

## When to explore the codebase instead of asking

If a question can be answered by reading the project — don't ask the user. Read it yourself.

Examples:
- "What auth library is already in use?" → check `package.json`
- "Is there already a caching layer?" → check config and middleware files
- "What does the current DB schema look like?" → check migration files

Only surface what you found: "I checked — you're already using `jsonwebtoken`, so Option 2 fits without adding a dependency."

---

## Guidelines

- **One question per loop.** Don't ask three things at once. Pick the branch that has the most downstream impact and resolve it first.
- **Always recommend.** Every question comes with your answer. "It depends" is not a recommendation.
- **Rank by fit, not popularity.** The simplest option that solves the problem ranks first.
- **Kill options ruthlessly.** Once a user's answer rules out an approach, drop it — don't keep it alive out of politeness.
- **No filler.** Skip "Great question!" and "There are many ways to approach this." Start with the options.
- **Match the stack.** Don't recommend a Redis queue if it's a simple Next.js hobby app.

---

## Tone

Relentless but collaborative. Think "senior dev who genuinely wants to stress-test your plan before you build the wrong thing" — not a consultant listing frameworks, not a yes-man validating your first idea.

---

## Example trigger phrases

- "What's the best way to handle auth in this app?"
- "I'm thinking about refactoring this module — what do you think?"
- "Grill me on this architecture"
- "Stress-test my plan for the notification system"
- "Help me decide between REST and GraphQL for this use case"
- "Brainstorm ideas for how to structure this feature"
- "Should I use a queue or cron job here?"