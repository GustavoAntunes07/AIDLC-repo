---
name: ux-improvement
description: >
  Use this skill when the user wants to improve the user experience of frontend code — components, layouts, interactions, or accessibility. Trigger on prompts like "improve the UX", "this feels clunky", "make this more accessible", "review my component", "this interaction is confusing", "improve usability", "check accessibility", "better loading states", "improve feedback to the user", "this form is hard to use", or any time the user wants to make the frontend more intuitive, responsive, or inclusive. Also trigger when the user shares a component and implicitly wants it to feel more polished. Do NOT trigger for pure styling requests with no UX intent (e.g. "change the color to blue") — that is a visual tweak, not a UX improvement.
---

# UX Improvement Skill

Reviews frontend components and code to identify UX and accessibility issues, then delivers concrete, prioritized improvements with code.

---

## Step 1 — Read the component(s)

Before commenting, read the relevant files:
- The component itself (JSX/TSX, Vue SFC, etc.)
- Any associated styles (CSS, Tailwind classes, CSS Modules)
- Parent context if needed to understand usage

If the user pastes code directly, work from that.

---

## Step 2 — Audit across four lenses

Evaluate the component through these four lenses and note findings before writing fixes:

### 🎯 Usability
- Is the intent of each interactive element immediately obvious?
- Are actions clearly labeled? (Avoid "Submit", "Click here", "OK" with no context)
- Are error, loading, empty, and success states handled?
- Is feedback immediate when the user does something?
- Are there dead clicks, broken flows, or confusing sequences?

### ♿ Accessibility (a11y)
- Are interactive elements keyboard-navigable (Tab, Enter, Space, Escape)?
- Do images have descriptive `alt` text?
- Are form inputs associated with `<label>` elements?
- Is color used as the *only* way to convey information? (red = error alone is not enough)
- Are ARIA roles/attributes used correctly — and only when needed?
- Is focus visible and logical in flow?
- Does text meet contrast ratio minimums (4.5:1 for body, 3:1 for large text)?

### 📱 Responsiveness
- Does the layout degrade gracefully on small screens?
- Are touch targets large enough (minimum 44×44px)?
- Is content readable without horizontal scrolling?

### ⚡ Interaction quality
- Are transitions and animations meaningful, not decorative?
- Is there optimistic UI or skeleton loading where appropriate?
- Are async operations (fetch, submit) clearly indicated with loading states?
- Are destructive actions (delete, reset) protected with confirmation?

---

## Step 3 — Deliver findings

Structure the output as:

```
## UX Audit — [Component Name]

### 🔴 Critical (fix now)
[Issues that block users or fail basic accessibility]

### 🟡 Important (fix soon)
[Issues that degrade experience but don't break it]

### 🟢 Nice to have (low priority)
[Polish improvements, minor friction points]
```

Each finding should include:
- **What**: what's wrong
- **Why it matters**: impact on the user
- **Fix**: concrete code change

---

## Step 4 — Apply the fixes

After the audit, rewrite the component (or the relevant sections) with all critical and important fixes applied. Show a clean, complete version — not a diff — unless the file is very large.

For each significant change, add a brief inline comment explaining the UX rationale:
```tsx
// Descriptive label so screen readers announce the action, not just "button"
<button aria-label="Delete task: Buy groceries">
```

---

## Guidelines

- **Prioritize accessibility.** WCAG 2.1 AA is the baseline. Keyboard and screen reader support are not optional.
- **Show, don't just tell.** Every finding needs a code fix, not just a description.
- **Don't over-engineer.** A simple `disabled` state beats a custom loading spinner library for a simple button.
- **Preserve the user's intent.** Don't restructure the component architecture unless it's causing UX problems. Improve, don't rewrite.
- **Be specific.** "Add a loading state" is incomplete. Show what the loading state looks like in code.
- **Flag assumptions.** If a fix depends on something outside the component (a design system, a hook, an API response), name it explicitly.

---

## Example trigger phrases

- "Review this component's UX"
- "This form feels confusing — improve it"
- "Check the accessibility of this modal"
- "The loading state is missing here"
- "Make this more usable on mobile"
- "Improve the feedback when the user submits"
- "This component feels rough — polish it"