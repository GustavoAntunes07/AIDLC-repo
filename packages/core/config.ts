import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
export type IntentStatus =
  | "backlog"
  | "context_ready"
  | "in_development"
  | "ready_for_testing"
  | "review"
  | "approved"
  | "done"
  | "closed"
  | "escalated";

export type AidlcConfig = {
  schemaVersion: number;
  workflowPreset: string;
  harness: string;
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

export const VALID_STATUSES: IntentStatus[] = [
  "backlog",
  "context_ready",
  "in_development",
  "ready_for_testing",
  "review",
  "approved",
  "done",
  "closed",
  "escalated",
];

const DEFAULT_TRANSITIONS: Record<IntentStatus, IntentStatus[]> = {
  backlog: ["context_ready", "closed", "escalated"],
  context_ready: ["in_development", "backlog", "closed", "escalated"],
  in_development: ["ready_for_testing", "context_ready", "closed", "escalated"],
  ready_for_testing: ["review", "in_development", "closed", "escalated"],
  review: ["approved", "in_development", "closed", "escalated"],
  approved: ["done", "review", "closed", "escalated"],
  done: [],
  closed: [],
  escalated: ["backlog", "closed"],
};

export const DEFAULT_CONFIG: AidlcConfig = {
  schemaVersion: 1,
  workflowPreset: "default",
  harness: "codex",
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
      "closed",
    ],
    standard: ["in_development", "done", "closed"],
    autonomous: ["done", "closed"],
  },
  transitions: DEFAULT_TRANSITIONS,
  terminalStatuses: ["done", "closed"],
  initialStatus: "backlog",
  maxReviewCycles: 3,
  defaultBranch: "main",
  developmentBranch: "dev",
  intentBranchPrefix: "intent/",
  enforceIntentBranch: true,
};

export const DEFAULT_CONFIG_YAML = `version: 1
workflow_preset: default
harness: codex
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
    - aidlc doctor

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
      - closed
  standard:
    description: Require approval before implementation and before final completion.
    approval_gates:
      - in_development
      - done
      - closed
  autonomous:
    description: Continue until validation fails, reviewer rejects, or risk/blockers require developer input.
    approval_gates:
      - done
      - closed

lifecycle:
  initial_status: backlog
  terminal_statuses:
    - done
    - closed
  transitions:
    backlog:
      - context_ready
      - closed
      - escalated
    context_ready:
      - in_development
      - backlog
      - closed
      - escalated
    in_development:
      - ready_for_testing
      - context_ready
      - closed
      - escalated
    ready_for_testing:
      - review
      - in_development
      - closed
      - escalated
    review:
      - approved
      - in_development
      - closed
      - escalated
    approved:
      - done
      - review
      - closed
      - escalated
    closed:
    escalated:
      - backlog
      - closed
`;

export function isIntentStatus(value: string | undefined): value is IntentStatus {
  return Boolean(value && VALID_STATUSES.includes(value as IntentStatus));
}

function pathFor(indentPaths: Map<number, string>, indent: number) {
  return [...indentPaths.entries()]
    .filter(([level]) => level < indent)
    .sort(([a], [b]) => a - b)
    .map(([, key]) => key);
}

export function parseConfigYaml(content: string): AidlcConfig {
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
    closed: [],
    escalated: [],
  };
  config.terminalStatuses = [];

  let hasVersion = false;
  const indentPaths = new Map<number, string>();
  const seen = new Set<string>();

  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    if (rawLine.includes("\t")) throw new Error("Configuration indentation must use spaces");

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
      } else if (parent === "lifecycle.terminal_statuses") {
        if (!isIntentStatus(value)) throw new Error(`Invalid terminal status: ${value}`);
        config.terminalStatuses.push(value);
      } else if (parent.startsWith("governance_profiles.") && parent.endsWith(".approval_gates")) {
        const profile = parent.split(".")[1];
        config.approvalGates[profile] = config.approvalGates[profile] ?? [];
        if (!isIntentStatus(value)) throw new Error(`Invalid approval gate: ${value}`);
        config.approvalGates[profile].push(value);
      } else if (parent.startsWith("lifecycle.transitions.")) {
        const from = parent.split(".")[2];
        if (!isIntentStatus(from) || !isIntentStatus(value)) throw new Error(`Invalid lifecycle transition: ${from} -> ${value}`);
        config.transitions[from].push(value);
      }

      continue;
    }

    const match = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (!match) throw new Error(`Invalid configuration line: ${trimmed}`);

    const [, key, value] = match;
    const parentPath = pathFor(indentPaths, indent);
    const fullPath = [...parentPath, key].join(".");
    if (seen.has(fullPath)) throw new Error(`Duplicate configuration key: ${fullPath}`);
    seen.add(fullPath);

    indentPaths.set(indent, key);

    if (!value) continue;

    if (fullPath === "version") { hasVersion = true; config.schemaVersion = Number(value); }
    if (fullPath === "workflow_preset") config.workflowPreset = value;
    if (fullPath === "harness") config.harness = value;
    if (fullPath === "governance_profile") config.governanceProfile = value;
    if (fullPath === "branches.default") config.defaultBranch = value;
    if (fullPath === "branches.development") config.developmentBranch = value;
    if (fullPath === "branches.intent_prefix") config.intentBranchPrefix = value;
    if (fullPath === "branches.enforce_intent_branch") {
      if (!["true", "false"].includes(value)) throw new Error("branches.enforce_intent_branch must be true or false");
      config.enforceIntentBranch = value === "true";
    }
    if (fullPath === "review.max_cycles") config.maxReviewCycles = Number(value);
    if (fullPath === "lifecycle.initial_status") {
      if (!isIntentStatus(value)) throw new Error(`Invalid initial status: ${value}`);
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

  if (!hasVersion) throw new Error("Missing configuration version");
  return config;
}

export function loadProjectConfig(root: string): AidlcConfig {
  const path = join(root, ".aidlc", "config.yaml");
  return existsSync(path) ? parseConfigYaml(readFileSync(path, "utf8")) : structuredClone(DEFAULT_CONFIG);
}

export function configErrors(config: AidlcConfig): string[] {
  const errors: string[] = [];
  if (config.schemaVersion !== 1) errors.push(`Unsupported configuration schema: ${config.schemaVersion}`);
  if (config.workflowPreset !== "default") errors.push(`Unsupported workflow preset: ${config.workflowPreset}`);
  if (config.harness !== "codex") errors.push(`Unsupported harness: ${config.harness}`);
  if (!config.approvalGates[config.governanceProfile]) errors.push(`Unknown governance profile: ${config.governanceProfile}`);
  if (!Number.isInteger(config.maxReviewCycles) || config.maxReviewCycles < 1) errors.push("review.max_cycles must be a positive integer");
  for (const agent of config.requiredAgents) {
    if (!/^[a-z][a-z0-9-]*$/.test(agent)) errors.push(`Invalid agent identifier: ${agent}`);
  }
  return errors;
}
