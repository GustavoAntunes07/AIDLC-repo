import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, normalize, resolve } from "node:path";

import { DEFAULT_CONFIG_YAML, VALID_STATUSES, isIntentStatus, loadProjectConfig, type IntentStatus, type AidlcConfig } from "../core/config";
import { inspectProject, validateProjectIntents } from "../core/project";
const INTENTS_DIR = "intents";
const DOCS_DIR = "docs";
const AIDLC_DIR = ".aidlc";
const CODEX_AGENTS_DIR = join(".codex", "agents");
const CONFIG_PATH = join(AIDLC_DIR, "config.yaml");

const REQUIRED_DIRS = [INTENTS_DIR, DOCS_DIR, ".codex", CODEX_AGENTS_DIR];

function ensureDir(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function read(path: string) {
  return readFileSync(path, "utf-8");
}

function write(path: string, content: string) {
  writeFileSync(path, content);
}

function getField(content: string, field: string) {
  return content.match(new RegExp(`^${field}:\\s*(.*)$`, "m"))?.[1]?.trim();
}

function setField(content: string, field: string, value: string) {
  const pattern = new RegExp(`^${field}:\\s*.*$`, "m");

  if (!pattern.test(content)) {
    throw new Error(`Missing field: ${field}`);
  }

  return content.replace(pattern, `${field}: ${value}`);
}

function upsertField(content: string, field: string, value: string) {
  const pattern = new RegExp(`^${field}:\\s*.*$`, "m");

  if (pattern.test(content)) {
    return content.replace(pattern, `${field}: ${value}`);
  }

  const statusPattern = /^status:\s*.*$/m;

  if (statusPattern.test(content)) {
    return content.replace(statusPattern, (line) => `${line}\n${field}: ${value}`);
  }

  throw new Error(`Missing field: status`);
}

function getIntentFiles() {
  ensureDir(INTENTS_DIR);

  return readdirSync(INTENTS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => join(INTENTS_DIR, file));
}

function getSection(content: string, heading: string) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:^|\\r?\\n)# ${escapedHeading}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n# |$)`,
  );

  return content.match(pattern)?.[1]?.trim() ?? "";
}

function hasAcceptanceCriteria(content: string) {
  const section = getSection(content, "Acceptance Criteria");
  return /- \[[ xX]\] .+/.test(section);
}

function allAcceptanceCriteriaChecked(content: string) {
  const section = getSection(content, "Acceptance Criteria");
  const criteria = section.match(/- \[[ xX]\] .+/g) ?? [];
  return criteria.length > 0 && criteria.every((item) => /^- \[[xX]\]/.test(item));
}

function getGitHeadPath() {
  const dotGitPath = ".git";
  const headPath = join(dotGitPath, "HEAD");

  if (existsSync(headPath)) {
    return headPath;
  }

  if (!existsSync(dotGitPath)) {
    return undefined;
  }

  const dotGitContent = read(dotGitPath).trim();
  const gitDir = dotGitContent.match(/^gitdir:\s*(.+)$/)?.[1]?.trim();

  if (!gitDir) {
    return undefined;
  }

  const resolvedGitDir = resolve(dirname(dotGitPath), gitDir);
  return join(resolvedGitDir, "HEAD");
}

function getCurrentGitBranch() {
  const headPath = getGitHeadPath();

  if (!headPath || !existsSync(headPath)) {
    return undefined;
  }

  const head = read(headPath).trim();
  const branch = head.match(/^ref:\s*refs\/heads\/(.+)$/)?.[1]?.trim();

  return branch || head;
}

function getGitDirPath() {
  const dotGitPath = ".git";

  if (!existsSync(dotGitPath)) {
    return undefined;
  }

  const headPath = join(dotGitPath, "HEAD");

  if (existsSync(headPath)) {
    return dotGitPath;
  }

  const dotGitContent = read(dotGitPath).trim();
  const gitDir = dotGitContent.match(/^gitdir:\s*(.+)$/)?.[1]?.trim();

  if (!gitDir) {
    return undefined;
  }

  return resolve(dirname(dotGitPath), gitDir);
}

function branchExists(branch: string) {
  const gitDir = getGitDirPath();

  if (!gitDir) {
    return false;
  }

  const looseRefPath = join(gitDir, "refs", "heads", ...branch.split("/"));

  if (existsSync(looseRefPath)) {
    return true;
  }

  const packedRefsPath = join(gitDir, "packed-refs");

  if (!existsSync(packedRefsPath)) {
    return false;
  }

  return read(packedRefsPath)
    .split(/\r?\n/)
    .some((line) => line.endsWith(` refs/heads/${branch}`));
}

function getRequiredIntentBranch(content: string) {
  const branch = getField(content, "branch");

  if (!branch || branch === "null") {
    return undefined;
  }

  return branch;
}

function createState() {
  ensureDir(AIDLC_DIR);

  const statePath = join(AIDLC_DIR, "state.json");

  if (!existsSync(statePath)) {
    write(
      statePath,
      JSON.stringify(
        {
          version: "1.0.0",
          initialized: true,
          created_at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  }
}

function createConfig() {
  ensureDir(AIDLC_DIR);

  if (!existsSync(CONFIG_PATH)) {
    write(CONFIG_PATH, DEFAULT_CONFIG_YAML);
  }
}

function loadConfig() { return loadProjectConfig(process.cwd()); }

function setup() {
  for (const dir of REQUIRED_DIRS) {
    ensureDir(dir);
  }

  createState();
  createConfig();

  console.log("AI-DLC structure initialized");
}

function checkSetup() {
  const result = inspectProject(process.cwd(), { intents: false });
  if (result.errors.length) {
    console.error("AI-DLC setup incomplete\n" + result.errors.join("\n"));
    process.exit(1);
  }
  console.log("AI-DLC setup complete");
}

function createIntent(title: string) {
  ensureDir(INTENTS_DIR);

  const shortId = createShortIntentId();
  const id = `INTENT-${shortId}`;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const config = loadConfig();

  const branch = `${config.intentBranchPrefix}${shortId}-${slug || "untitled"}`;
  const filePath = join(INTENTS_DIR, `${id}.md`);

  const content = `---
id: ${id}
title: ${title}
status: ${config.initialStatus}
story_points: 1
retry_count: 0
branch: ${branch}
---

# Description

${title}

# Acceptance Criteria

- [ ] Define acceptance criteria

# Related Files

# Implementation Notes

# Test Notes

# Review Notes

# Commits
`;

  write(filePath, content);

  console.log(`Created ${filePath}`);
}

function createShortIntentId() {
  const baseId = Date.now().toString(36).slice(-4).padStart(4, "0");
  let candidate = baseId;
  let attempt = 0;

  while (existsSync(join(INTENTS_DIR, `INTENT-${candidate}.md`))) {
    attempt += 1;
    candidate = `${baseId}${attempt.toString(36)}`;
  }

  return candidate;
}

function status() {
  const files = getIntentFiles();

  const counts: Record<string, number> = {};

  for (const validStatus of VALID_STATUSES) {
    counts[validStatus] = 0;
  }

  for (const file of files) {
    const content = read(file);
    const currentStatus = getField(content, "status");

    if (currentStatus) {
      counts[currentStatus] = (counts[currentStatus] ?? 0) + 1;
    }
  }

  console.log("\nAI-DLC Status\n");

  for (const [key, value] of Object.entries(counts)) {
    console.log(`${key}: ${value}`);
  }
}

function listIntents() {
  const files = getIntentFiles();

  for (const file of files) {
    const content = read(file);

    console.log(
      `${getField(content, "id")} | ${getField(content, "status")} | ${getField(content, "title")}`,
    );
  }
}

function nextIntent() {
  const priority: IntentStatus[] = [
    "review",
    "ready_for_testing",
    "in_development",
    "context_ready",
    "backlog",
  ];

  const intents = getIntentFiles().map((file) => {
    const content = read(file);

    return {
      file,
      id: getField(content, "id"),
      title: getField(content, "title"),
      status: getField(content, "status") as IntentStatus,
      branch: getField(content, "branch"),
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

function validateIntents() {
  const errors = validateProjectIntents(process.cwd());
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("All intents are valid");
}

function findIntent(identifier: string) {
  const normalized = normalize(identifier);
  const files = getIntentFiles();

  return files.find((file) => {
    const content = read(file);
    return (
      normalize(file) === normalized ||
      basename(file) === identifier ||
      getField(content, "id") === identifier
    );
  });
}

function guardTransition(content: string, to: IntentStatus) {
  const errors: string[] = [];

  if (to === "context_ready") {
    if (!getSection(content, "Description")) {
      errors.push("Definition of Ready requires a description.");
    }

    if (!hasAcceptanceCriteria(content)) {
      errors.push("Definition of Ready requires acceptance criteria.");
    }

    if (!getSection(content, "Related Files")) {
      errors.push("Definition of Ready requires related project context.");
    }
  }

  if (to === "done") {
    if (!allAcceptanceCriteriaChecked(content)) {
      errors.push("Definition of Done requires all acceptance criteria to be checked.");
    }

    if (!getSection(content, "Test Notes")) {
      errors.push("Definition of Done requires test notes.");
    }

    if (!/approved/i.test(getSection(content, "Review Notes"))) {
      errors.push("Definition of Done requires reviewer approval in Review Notes.");
    }
  }

  return errors;
}

function guardIntentBranch(content: string, config: AidlcConfig, to: IntentStatus) {
  if (!config.enforceIntentBranch || to !== "in_development") {
    return [];
  }

  const requiredBranch = getRequiredIntentBranch(content);
  const currentBranch = getCurrentGitBranch();
  const errors: string[] = [];

  if (!requiredBranch) {
    errors.push("Intent branch enforcement requires a branch field.");
  }

  if (!currentBranch) {
    errors.push("Unable to determine the current Git branch.");
  }

  if (requiredBranch && currentBranch && currentBranch !== requiredBranch) {
    const command = branchExists(requiredBranch)
      ? `git switch ${requiredBranch}`
      : `git switch -c ${requiredBranch}`;

    errors.push(
      `Intent branch mismatch. Current branch is ${currentBranch}; required branch is ${requiredBranch}.`,
    );
    errors.push(`Run: ${command}`);
  }

  return errors;
}

function transitionIntent(identifier: string | undefined, target: string | undefined) {
  if (!identifier || !target) {
    console.error("Usage: bun aidlc transition <intent-id|file> <target-status>");
    process.exit(1);
  }

  if (!isIntentStatus(target)) {
    console.error(`Invalid target status: ${target}`);
    process.exit(1);
  }

  const file = findIntent(identifier);

  if (!file) {
    console.error(`Intent not found: ${identifier}`);
    process.exit(1);
  }

  const config = loadConfig();
  const content = read(file);
  const currentStatus = getField(content, "status");

  if (!isIntentStatus(currentStatus)) {
    console.error(`${file} has invalid current status: ${currentStatus}`);
    process.exit(1);
  }

  const allowedTargets = config.transitions[currentStatus] ?? [];

  if (!allowedTargets.includes(target)) {
    console.error(
      `Invalid transition for ${identifier}: ${currentStatus} -> ${target}`,
    );
    console.error(`Allowed: ${allowedTargets.join(", ") || "(none)"}`);
    process.exit(1);
  }

  const guardErrors = guardTransition(content, target);
  guardErrors.push(...guardIntentBranch(content, config, target));

  if (guardErrors.length > 0) {
    console.error(`\nTransition blocked: ${currentStatus} -> ${target}\n`);

    for (const error of guardErrors) {
      console.error(`- ${error}`);
    }

    process.exit(1);
  }

  write(file, setField(content, "status", target));

  console.log(`Transitioned ${identifier}: ${currentStatus} -> ${target}`);

  const gates = config.approvalGates[config.governanceProfile] ?? [];

  if (gates.includes(target)) {
    console.log(
      `Approval gate reached for governance profile: ${config.governanceProfile}`,
    );
  }
}

function closeIntent(identifier: string | undefined, reasonParts: string[]) {
  if (!identifier) {
    console.error("Usage: bun aidlc close <intent-id|file> [reason]");
    process.exit(1);
  }

  const file = findIntent(identifier);

  if (!file) {
    console.error(`Intent not found: ${identifier}`);
    process.exit(1);
  }

  const config = loadConfig();
  const content = read(file);
  const currentStatus = getField(content, "status");

  if (!isIntentStatus(currentStatus)) {
    console.error(`${file} has invalid current status: ${currentStatus}`);
    process.exit(1);
  }

  if (currentStatus !== "closed" && config.terminalStatuses.includes(currentStatus)) {
    console.error(`Cannot close terminal intent: ${currentStatus}`);
    process.exit(1);
  }

  const reason = reasonParts.join(" ").replace(/\r?\n/g, " ").trim();
  let updatedContent = setField(content, "status", "closed");

  if (reason) {
    updatedContent = upsertField(updatedContent, "closed_reason", reason);
  }

  write(file, updatedContent);

  console.log(`Closed ${identifier}${reason ? `: ${reason}` : ""}`);
}

function checkIntentBranch(identifier: string | undefined) {
  if (!identifier) {
    console.error("Usage: bun aidlc branch <intent-id|file>");
    process.exit(1);
  }

  const file = findIntent(identifier);

  if (!file) {
    console.error(`Intent not found: ${identifier}`);
    process.exit(1);
  }

  const content = read(file);
  const requiredBranch = getRequiredIntentBranch(content);
  const currentBranch = getCurrentGitBranch();

  if (!requiredBranch) {
    console.error(`${identifier} does not define a branch.`);
    process.exit(1);
  }

  console.log(`Intent branch: ${requiredBranch}`);
  console.log(`Intent branch exists: ${branchExists(requiredBranch) ? "yes" : "no"}`);

  if (!currentBranch) {
    console.log("Current branch: unknown");
    const command = branchExists(requiredBranch)
      ? `git switch ${requiredBranch}`
      : `git switch -c ${requiredBranch}`;
    console.log(`Run: ${command}`);
    process.exit(1);
  }

  console.log(`Current branch: ${currentBranch}`);

  if (currentBranch !== requiredBranch) {
    const command = branchExists(requiredBranch)
      ? `git switch ${requiredBranch}`
      : `git switch -c ${requiredBranch}`;

    console.log("Branch status: mismatch");
    console.log(`Run: ${command}`);
    process.exit(1);
  }

  console.log("Branch status: ok");
}

function showConfig() {
  const config = loadConfig();

  console.log(JSON.stringify(config, null, 2));
}

function doctor() {
  console.log("\nAI-DLC Doctor\n");

  checkSetup();
  validateIntents();

  console.log("\nAI-DLC doctor completed");
}

function help() {
  console.log(`
AI-DLC CLI

Usage:
  bun scripts/aidlc.ts setup
  bun scripts/aidlc.ts check-setup
  bun scripts/aidlc.ts new "Add login page"
  bun scripts/aidlc.ts status
  bun scripts/aidlc.ts list
  bun scripts/aidlc.ts next
  bun scripts/aidlc.ts validate
  bun scripts/aidlc.ts config
  bun scripts/aidlc.ts branch <intent-id|file>
  bun scripts/aidlc.ts transition <intent-id|file> <target-status>
  bun scripts/aidlc.ts close <intent-id|file> [reason]
  bun scripts/aidlc.ts doctor
`);
}

export function runLegacy(argv: string[]) {
const [command, ...args] = argv;

switch (command) {
  case "setup":
    setup();
    break;

  case "check-setup":
    checkSetup();
    break;

  case "new":
    createIntent(args.join(" ") || "Untitled intent");
    break;

  case "status":
    status();
    break;

  case "list":
    listIntents();
    break;

  case "next":
    nextIntent();
    break;

  case "validate":
    validateIntents();
    break;

  case "config":
    showConfig();
    break;

  case "branch":
    checkIntentBranch(args[0]);
    break;

  case "transition":
    transitionIntent(args[0], args[1]);
    break;

  case "close":
    closeIntent(args[0], args.slice(1));
    break;

  case "doctor":
    doctor();
    break;

  default:
    help();
}

}
