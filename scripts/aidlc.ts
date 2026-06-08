import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const INTENTS_DIR = "intents";

type IntentStatus =
  | "backlog"
  | "context_ready"
  | "in_development"
  | "ready_for_testing"
  | "review"
  | "approved"
  | "done"
  | "escalated";

function ensureIntentsDir() {
  if (!existsSync(INTENTS_DIR)) {
    mkdirSync(INTENTS_DIR);
  }
}

function getIntentFiles() {
  ensureIntentsDir();

  return readdirSync(INTENTS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => join(INTENTS_DIR, file));
}

function getField(content: string, field: string) {
  return content.match(new RegExp(`^${field}:\\s*(.+)$`, "m"))?.[1]?.trim();
}

function createIntent(title: string) {
  ensureIntentsDir();

  const id = `INTENT-${String(Date.now()).slice(-6)}`;
  const filePath = join(INTENTS_DIR, `${id}.md`);

  const content = `---
id: ${id}
title: ${title}
status: backlog
story_points: 1
retry_count: 0
branch: null
---

## Description

${title}

## Acceptance criteria

- [ ] Define acceptance criteria

## Related files

## Implementation notes

## Test notes

## Review notes

## Commits
`;

  writeFileSync(filePath, content);
  console.log(`Created ${filePath}`);
}

function status() {
  const files = getIntentFiles();

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const id = getField(content, "id");
    const title = getField(content, "title");
    const currentStatus = getField(content, "status");

    console.log(`${id} | ${currentStatus} | ${title}`);
  }
}

function next() {
  const priority: IntentStatus[] = [
    "review",
    "ready_for_testing",
    "in_development",
    "context_ready",
    "backlog",
  ];

  const intents = getIntentFiles().map((file) => {
    const content = readFileSync(file, "utf-8");

    return {
      file,
      id: getField(content, "id"),
      title: getField(content, "title"),
      status: getField(content, "status") as IntentStatus,
    };
  });

  const selected = intents
    .filter((intent) => priority.includes(intent.status))
    .sort((a, b) => priority.indexOf(a.status) - priority.indexOf(b.status))[0];

  if (!selected) {
    console.log("No pending intents found.");
    return;
  }

  console.log(JSON.stringify(selected, null, 2));
}

function validate() {
  const requiredFields = ["id", "title", "status", "story_points", "retry_count", "branch"];
  let hasError = false;

  for (const file of getIntentFiles()) {
    const content = readFileSync(file, "utf-8");

    for (const field of requiredFields) {
      if (!getField(content, field)) {
        console.error(`${file} is missing field: ${field}`);
        hasError = true;
      }
    }
  }

  if (hasError) {
    process.exit(1);
  }

  console.log("All intents are valid.");
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "new":
    createIntent(args.join(" ") || "Untitled intent");
    break;

  case "status":
    status();
    break;

  case "next":
    next();
    break;

  case "validate":
    validate();
    break;

  default:
    console.log(`
Usage:
  bun scripts/aidlc.ts new "Add login page"
  bun scripts/aidlc.ts status
  bun scripts/aidlc.ts next
  bun scripts/aidlc.ts validate
`);
}