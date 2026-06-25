---
name: design-system
description: >
  Use this skill when the user wants to define, document, or evolve project visual design standards. Trigger on prompts like "define our design system", "set up design tokens", "document the typography", "create a style guide", "establish design standards", or "add a component pattern". Do not trigger for one-off styling tweaks with no intent to systematize.
---

# Design System Skill

Captures, formalizes, and documents visual design standards for a project from developer-provided examples, existing code, explicit declarations, or existing documentation.

---

## AI-DLC Rules

Project rules override this skill.

- Read-only design-system analysis does not require an intent.
- Creating or editing `docs/design-system.md` or `docs/design-system-preview.html` is persistent documentation work.
- For persistent documentation work, use an intent and verify the intent branch unless the developer explicitly says the work is outside the lifecycle.
- Do not commit or push unless the developer explicitly approves.
- Do not overwrite existing standards. Merge carefully and flag conflicts.
- Run project validation commands before marking documentation work complete.

---

## Source Priority

Resolve design decisions in this order:

1. Visual examples provided by the developer, such as screenshots, images, Figma links, or reference sites
2. Explicit declarations in the prompt
3. Existing code, such as CSS variables, Tailwind config, theme files, tokens, or component files
4. Existing `docs/design-system.md`
5. Questions to the developer when none of the sources above resolve a dimension

Never invent standards when evidence exists. Never ask when the answer is already in the codebase.

---

## Step 1: Audit Existing Standards

Before writing recommendations:

- Check for `docs/design-system.md` and load it as the current baseline
- Scan for design tokens: `tailwind.config.*`, CSS custom properties, theme files, `tokens.json`
- Read key component files to infer patterns in use
- Note any visual references the user provided

Summarize what you found:

```txt
Found: Tailwind config with custom colors, 3 button variants in /components/ui
Missing: typography scale, spacing system, grid definition
```

---

## Step 2: Formalize What Is Known

For every dimension that can be resolved from sources 1-4, prepare the documentation content. Do not ask about things already defined.

Cover these dimensions:

### Colors

- Primary, secondary, accent, and neutral scales
- Semantic roles: background, surface, border, text, error, success, warning, info
- Token name, value, role, and usage notes

### Typography

- Font families for heading, body, and mono
- Size, line-height, weight, and letter spacing when available
- Levels such as h1-h6, body-lg, body, body-sm, caption, and label

### Spacing

- Base unit
- Scale steps
- Named tokens when applicable

### Components

- Variants by size, state, and intent
- Anatomy
- Behavior notes: hover, focus, disabled, loading, error states

### Layout And Grid

- Max content width
- Column grid, gutters, and margins
- Breakpoints and names
- Common layout patterns

### Motion And Elevation

- Durations and easing
- Shadow scale
- Z-index layers

---

## Step 3: Resolve Missing Decisions

For each unresolved dimension, ask one decision-forcing question at a time and provide a recommendation.

Format:

```txt
Question: Which base spacing unit should the system use?
Recommendation: Use 8px because it gives a clean scale: 8, 16, 24, 32, 48, 64.
```

Work through dimensions in this order: colors, typography, spacing, components, layout, motion.

---

## Step 4: Update Or Propose `docs/design-system.md`

If file edits are authorized, update `docs/design-system.md`. If the task is read-only or not yet in an approved lifecycle, present the proposed content and ask before writing.

Structure:

```markdown
# Design System

> Last updated: YYYY-MM-DD.

## Colors

| Token | Value | Role | Usage |
| --- | --- | --- | --- |

## Typography

| Level | Font | Size | Weight | Line Height |
| --- | --- | --- | --- | --- |

## Spacing

| Token | Value | Usage |
| --- | --- | --- |

## Components

### Component Name

Variants, anatomy, states, and behavior.

## Layout And Grid

Breakpoints, grid, widths, and layout patterns.

## Motion And Elevation

Transitions, shadows, and z-index.

## Decision Log

Brief record of key choices and rationale.
```

If `docs/design-system.md` already exists, merge new definitions into it. If sources conflict, stop and surface the conflict:

```txt
Conflict: docs/design-system.md defines primary as #3B82F6, but Tailwind config uses #1D4ED8. Which source should win?
```

---

## Step 5: Optional Visual Preview

Offer a preview only after documenting or proposing standards:

```txt
Want me to generate a self-contained HTML preview showing these standards in action?
```

Only proceed if the developer confirms. Generate `docs/design-system-preview.html` only when persistent file edits are authorized.

The preview should demonstrate:

- Color palette swatches
- Type scale
- Spacing scale
- Documented components and variants

---

## Guidelines

- Never invent values when evidence exists.
- Merge, do not overwrite.
- Flag conflicts explicitly.
- Ask one question at a time.
- Always include a concrete recommendation with each question.
- Keep the doc readable by humans.
- Preserve project conventions and existing token names.

---

## Example Trigger Phrases

- "Let's define our design system"
- "Document our color palette and typography"
- "I want to formalize the design tokens for this project"
- "Here's a screenshot of the style I want; capture it as standards"
- "Set up a style guide for this repo"
- "What design patterns are we using in this project?"
- "Add the card component to our design system"
