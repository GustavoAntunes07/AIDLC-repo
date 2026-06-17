import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, normalize, resolve } from "node:path";

type IntentStatus =
  | "backlog"
  | "context_ready"
  | "in_development"
  | "ready_for_testing"
  | "review"
  | "approved"
  | "done"
  | "escalated";

type AidlcConfig = {
  governanceProfile: string;
  validationCommands: string[];
  requiredAgents: string[];
  approvalGates: Record<string, IntentStatus[]>;
  transitions: Record<IntentStatus, IntentStatus[]>;
  terminalStatuses: IntentStatus[];
  initialStatus: IntentStatus;
  maxReviewCycles: number;
  defaultBranch: string;
  developmentBranch: string;
  intentBranchPrefix: string;
  enforceIntentBranch: boolean;
};

const INTENTS_DIR = "intents";
const DOCS_DIR = "docs";
const AIDLC_DIR = ".aidlc";
const CODEX_AGENTS_DIR = join(".codex", "agents");
const CONFIG_PATH = join(AIDLC_DIR, "config.yaml");

const REQUIRED_FILES = ["AGENTS.md", "AIDLC.md", CONFIG_PATH];

const REQUIRED_DIRS = [INTENTS_DIR, DOCS_DIR, ".codex", CODEX_AGENTS_DIR];

const PLACEHOLDERS = [
  "[Project-name]",
  "[Project-description]",
  "[Tech-stack]",
  "Description: ...",
  "TODO",
];

const VALID_STATUSES: IntentStatus[] = [
  "backlog",
  "context_ready",
  "in_development",
  "ready_for_testing",
  "review",
  "approved",
  "done",
  "escalated",
];

const DEFAULT_TRANSITIONS: Record<IntentStatus, IntentStatus[]> = {
  backlog: ["context_ready", "escalated"],
  context_ready: ["in_development", "backlog", "escalated"],
  in_development: ["ready_for_testing", "context_ready", "escalated"],
  ready_for_testing: ["review", "in_development", "escalated"],
  review: ["approved", "in_development", "escalated"],
  approved: ["done", "review", "escalated"],
  done: [],
  escalated: ["backlog"],
};

const DEFAULT_CONFIG: AidlcConfig = {
  governanceProfile: "strict",
  validationCommands: ["bun aidlc:doctor"],
  requiredAgents: [
    "aidlc-orchestrator",
    "reader",
    "planner",
    "builder",
    "tester",
    "reviewer",
    "documenter",
  ],
  approvalGates: {
    strict: [
      "context_ready",
      "in_development",
      "ready_for_testing",
      "review",
      "approved",
      "done",
    ],
    standard: ["in_development", "done"],
    autonomous: ["done"],
  },
  transitions: DEFAULT_TRANSITIONS,
  terminalStatuses: ["done"],
  initialStatus: "backlog",
  maxReviewCycles: 3,
  defaultBranch: "main",
  developmentBranch: "dev",
  intentBranchPrefix: "intent/",
  enforceIntentBranch: true,
};

const DEFAULT_CONFIG_YAML = `version: 1
governance_profile: strict

branches:
  default: main
  development: dev
  intent_prefix: intent/
  enforce_intent_branch: true

review:
  max_cycles: 3
  mode: manual

validation:
  commands:
    - bun aidlc:doctor

agents:
  required:
    - aidlc-orchestrator
    - reader
    - planner
    - builder
    - tester
    - reviewer
    - documenter

governance_profiles:
  strict:
    description: Stop after every lifecycle stage for explicit developer approval.
    approval_gates:
      - context_ready
      - in_development
      - ready_for_testing
      - review
      - approved
      - done
  standard:
    description: Require approval before implementation and before final completion.
    approval_gates:
      - in_development
      - done
  autonomous:
    description: Continue until validation fails, reviewer rejects, or risk/blockers require developer input.
    approval_gates:
      - done

lifecycle:
  initial_status: backlog
  terminal_statuses:
    - done
  transitions:
    backlog:
      - context_ready
      - escalated
    context_ready:
      - in_development
      - backlog
      - escalated
    in_development:
      - ready_for_testing
      - context_ready
      - escalated
    ready_for_testing:
      - review
      - in_development
      - escalated
    review:
      - approved
      - in_development
      - escalated
    approved:
      - done
      - review
      - escalated
    escalated:
      - backlog
`;

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

function isIntentStatus(value: string | undefined): value is IntentStatus {
  return Boolean(value && VALID_STATUSES.includes(value as IntentStatus));
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

function pathFor(indentPaths: Map<number, string>, indent: number) {
  return [...indentPaths.entries()]
    .filter(([level]) => level < indent)
    .sort(([a], [b]) => a - b)
    .map(([, key]) => key);
}

function parseConfigYaml(content: string): AidlcConfig {
  const config: AidlcConfig = {
    ...DEFAULT_CONFIG,
    validationCommands: [...DEFAULT_CONFIG.validationCommands],
    requiredAgents: [...DEFAULT_CONFIG.requiredAgents],
    approvalGates: Object.fromEntries(
      Object.entries(DEFAULT_CONFIG.approvalGates).map(([key, value]) => [
        key,
        [...value],
      ]),
    ),
    transitions: Object.fromEntries(
      Object.entries(DEFAULT_CONFIG.transitions).map(([key, value]) => [
        key,
        [...value],
      ]),
    ) as Record<IntentStatus, IntentStatus[]>,
    terminalStatuses: [...DEFAULT_CONFIG.terminalStatuses],
  };

  config.validationCommands = [];
  config.requiredAgents = [];
  config.approvalGates = {};
  config.transitions = {
    backlog: [],
    context_ready: [],
    in_development: [],
    ready_for_testing: [],
    review: [],
    approved: [],
    done: [],
    escalated: [],
  };
  config.terminalStatuses = [];

  const indentPaths = new Map<number, string>();

  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;

    const indent = rawLine.match(/^ */)?.[0].length ?? 0;
    const trimmed = rawLine.trim();

    for (const level of [...indentPaths.keys()]) {
      if (level >= indent) indentPaths.delete(level);
    }

    if (trimmed.startsWith("- ")) {
      const value = trimmed.slice(2).trim();
      const parent = pathFor(indentPaths, indent + 1).join(".");

      if (parent === "validation.commands") {
        config.validationCommands.push(value);
      } else if (parent === "agents.required") {
        config.requiredAgents.push(value);
      } else if (parent === "lifecycle.terminal_statuses" && isIntentStatus(value)) {
        config.terminalStatuses.push(value);
      } else if (parent.startsWith("governance_profiles.") && parent.endsWith(".approval_gates")) {
        const profile = parent.split(".")[1];
        config.approvalGates[profile] = config.approvalGates[profile] ?? [];
        if (isIntentStatus(value)) config.approvalGates[profile].push(value);
      } else if (parent.startsWith("lifecycle.transitions.")) {
        const from = parent.split(".")[2];
        if (isIntentStatus(from) && isIntentStatus(value)) {
          config.transitions[from].push(value);
        }
      }

      continue;
    }

    const match = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;

    const [, key, value] = match;
    const parentPath = pathFor(indentPaths, indent);
    const fullPath = [...parentPath, key].join(".");

    indentPaths.set(indent, key);

    if (!value) continue;

    if (fullPath === "governance_profile") config.governanceProfile = value;
    if (fullPath === "branches.default") config.defaultBranch = value;
    if (fullPath === "branches.development") config.developmentBranch = value;
    if (fullPath === "branches.intent_prefix") config.intentBranchPrefix = value;
    if (fullPath === "branches.enforce_intent_branch") {
      config.enforceIntentBranch = value === "true";
    }
    if (fullPath === "review.max_cycles") config.maxReviewCycles = Number(value);
    if (fullPath === "lifecycle.initial_status" && isIntentStatus(value)) {
      config.initialStatus = value;
    }
  }

  if (config.validationCommands.length === 0) {
    config.validationCommands = [...DEFAULT_CONFIG.validationCommands];
  }

  if (config.requiredAgents.length === 0) {
    config.requiredAgents = [...DEFAULT_CONFIG.requiredAgents];
  }

  if (config.terminalStatuses.length === 0) {
    config.terminalStatuses = [...DEFAULT_CONFIG.terminalStatuses];
  }

  return config;
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }

  return parseConfigYaml(read(CONFIG_PATH));
}

function validateConfig(config: AidlcConfig) {
  const errors: string[] = [];

  if (!config.approvalGates[config.governanceProfile]) {
    errors.push(`Unknown governance profile: ${config.governanceProfile}`);
  }

  for (const status of VALID_STATUSES) {
    if (!Array.isArray(config.transitions[status])) {
      errors.push(`Missing lifecycle transitions for status: ${status}`);
    }
  }

  for (const [from, targets] of Object.entries(config.transitions)) {
    if (!isIntentStatus(from)) {
      errors.push(`Invalid transition source: ${from}`);
    }

    for (const target of targets) {
      if (!isIntentStatus(target)) {
        errors.push(`Invalid transition target from ${from}: ${target}`);
      }
    }
  }

  for (const agent of config.requiredAgents) {
    const agentPath = join(CODEX_AGENTS_DIR, `${agent}.toml`);

    if (!existsSync(agentPath)) {
      errors.push(`Missing required agent: ${agentPath}`);
    }
  }

  if (!Number.isFinite(config.maxReviewCycles) || config.maxReviewCycles < 1) {
    errors.push("review.max_cycles must be a positive number");
  }

  return errors;
}

function setup() {
  for (const dir of REQUIRED_DIRS) {
    ensureDir(dir);
  }

  createState();
  createConfig();

  console.log("AI-DLC structure initialized");
}

function checkSetup() {
  const errors: string[] = [];

  for (const file of REQUIRED_FILES) {
    if (!existsSync(file)) {
      errors.push(`Missing file: ${file}`);
    }
  }

  for (const dir of REQUIRED_DIRS) {
    if (!existsSync(dir)) {
      errors.push(`Missing directory: ${dir}`);
    }
  }

  if (!existsSync(join(AIDLC_DIR, "state.json"))) {
    errors.push("Missing .aidlc/state.json. Run `bun aidlc setup`.");
  }

  for (const file of REQUIRED_FILES) {
    if (!existsSync(file)) continue;

    const content = read(file);

    for (const placeholder of PLACEHOLDERS) {
      if (content.includes(placeholder)) {
        errors.push(`Placeholder found in ${file}: ${placeholder}`);
      }
    }
  }

  if (existsSync(CONFIG_PATH)) {
    errors.push(...validateConfig(loadConfig()));
  }

  if (errors.length > 0) {
    console.error("\nAI-DLC setup incomplete\n");

    for (const error of errors) {
      console.error(`- ${error}`);
    }

    process.exit(1);
  }

  console.log("AI-DLC setup complete");
}

function createIntent(title: string) {
  ensureDir(INTENTS_DIR);

  const numericId = String(Date.now()).slice(-6);
  const id = `INTENT-${numericId}`;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const config = loadConfig();

  const branch = `${config.intentBranchPrefix}${numericId}-${slug || "untitled"}`;
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

function validateIntentFile(file: string, config: AidlcConfig) {
  const requiredFields = [
    "id",
    "title",
    "status",
    "story_points",
    "retry_count",
    "branch",
  ];
  const errors: string[] = [];
  const content = read(file);

  for (const field of requiredFields) {
    const value = getField(content, field);

    if (value === undefined || value === "") {
      errors.push(`${file} is missing field: ${field}`);
    }
  }

  const currentStatus = getField(content, "status");

  if (currentStatus && !isIntentStatus(currentStatus)) {
    errors.push(`${file} has invalid status: ${currentStatus}`);
  }

  const branch = getField(content, "branch");

  if (branch && branch !== "null" && !branch.startsWith(config.intentBranchPrefix)) {
    errors.push(`${file} branch must start with ${config.intentBranchPrefix}`);
  }

  if (!getSection(content, "Description")) {
    errors.push(`${file} is missing a Description section body`);
  }

  if (!hasAcceptanceCriteria(content)) {
    errors.push(`${file} must define at least one acceptance criterion`);
  }

  return errors;
}

function validateIntents() {
  const config = loadConfig();
  const errors = getIntentFiles().flatMap((file) => validateIntentFile(file, config));

  if (errors.length > 0) {
    console.error("\nInvalid intents\n");

    for (const error of errors) {
      console.error(`- ${error}`);
    }

    process.exit(1);
  }

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
  bun scripts/aidlc.ts doctor
`);
}

const [command, ...args] = process.argv.slice(2);

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

  case "doctor":
    doctor();
    break;

  default:
    help();
}
