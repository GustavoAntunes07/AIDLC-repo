import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bindingErrors, isHarness, ROLE_NAMES, type RoleBinding } from "./harness";
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
  intentSchema: string;
  harness: string;
  observerEnabled: boolean;
  roleBindings: Record<string, RoleBinding>;
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

export const DEFAULT_TRANSITIONS: Record<IntentStatus, IntentStatus[]> = {
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

export const COMPACT_TRANSITIONS: Record<IntentStatus, IntentStatus[]> = {
  backlog: ["context_ready", "closed", "escalated"],
  context_ready: ["in_development", "backlog", "closed", "escalated"],
  in_development: ["review", "context_ready", "closed", "escalated"],
  ready_for_testing: [],
  review: ["done", "in_development", "closed", "escalated"],
  approved: [], done: [], closed: [], escalated: ["backlog", "closed"],
};
export const WORKFLOW_PRESETS = {
  default: { schema: "full-v1", roles: ["aidlc-orchestrator", "reader", "planner", "builder", "tester", "reviewer", "documenter"], transitions: DEFAULT_TRANSITIONS, states: VALID_STATUSES },
  compact: { schema: "compact-v1", roles: ["planner", "builder", "reviewer"], transitions: COMPACT_TRANSITIONS, states: VALID_STATUSES.filter(s => !["ready_for_testing", "approved"].includes(s)) },
};
export function workflowPreset(name: string) {
  if (name !== "default" && name !== "compact") throw new Error(`Unsupported workflow preset: ${name}`);
  return WORKFLOW_PRESETS[name];
}

export const DEFAULT_CONFIG: AidlcConfig = {
  schemaVersion: 1,
  workflowPreset: "default",
  intentSchema: "full-v1",
  harness: "codex",
  observerEnabled: false,
  roleBindings: {},
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

observer:
  enabled: false

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
    roleBindings: {},
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
      } else if (parent === "observer" || parent.startsWith("observer.")) {
        throw new Error(`Configuration ${parent} requires mapping syntax with observer.enabled: true or false`);
      } else if (parent === "role_models" || parent.startsWith("role_models.")) {
        throw new Error(`Configuration ${parent} requires mapping syntax`);
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

    const blockPath = ["observer", "branches", "review", "validation", "validation.commands", "agents", "agents.required", "governance_profiles", "lifecycle", "lifecycle.terminal_statuses", "lifecycle.transitions"].includes(fullPath)
      || fullPath === "role_models" || /^role_models\.[^.]+$/.test(fullPath)
      || /^governance_profiles\.[^.]+(?:\.approval_gates)?$/.test(fullPath)
      || /^lifecycle\.transitions\.[^.]+$/.test(fullPath);
    if (blockPath && value) throw new Error(`Configuration ${fullPath} requires block syntax; scalar and inline values are unsupported`);
    if (fullPath.startsWith("observer.")) {
      if (fullPath !== "observer.enabled") throw new Error(`Unknown observer setting: ${fullPath}`);
      if (!["true", "false"].includes(value)) throw new Error("observer.enabled must be true or false");
      config.observerEnabled = value === "true";
    }
    if (["workflow_preset", "intent_schema", "harness", "governance_profile"].includes(fullPath) && !value) throw new Error(`Missing configuration value: ${fullPath}`);
    if (fullPath.startsWith("lifecycle.transitions.") && !isIntentStatus(fullPath.split(".")[2])) throw new Error(`Invalid lifecycle transition state: ${key}`);
    if (fullPath.startsWith("role_models.")) {
      const [, role, setting, ...extra] = fullPath.split(".");
      if (!ROLE_NAMES.includes(role)) throw new Error(`Unsupported role binding: ${role}`);
      if (setting !== undefined) {
        if (extra.length || !["model", "reasoning"].includes(setting) || !value) throw new Error(`Invalid role model setting: ${fullPath}`);
        let parsed = value;
        if (value.startsWith('"')) {
          try { parsed = JSON.parse(value); } catch { throw new Error(`Invalid quoted role model setting: ${fullPath}`); }
        } else if (value.startsWith("'")) {
          if (!/^'(?:[^']|'')*'$/.test(value)) throw new Error(`Invalid quoted role model setting: ${fullPath}`);
          parsed = value.slice(1, -1).replaceAll("''", "'");
        } else if (/^[\[\]{}]/.test(value)) throw new Error(`Invalid role model setting: ${fullPath}`);
        else if (/^#|\s#/.test(value)) throw new Error(`Inline comments are unsupported in ${fullPath}; put the comment on its own line or quote the value`);
        if (typeof parsed !== "string") throw new Error(`Invalid role model setting: ${fullPath}`);
        config.roleBindings[role] ??= {};
        config.roleBindings[role][setting as keyof RoleBinding] = parsed;
      }
    }
    if (!value) continue;

    if (fullPath === "version") { hasVersion = true; config.schemaVersion = Number(value); }
    if (fullPath === "workflow_preset") config.workflowPreset = value;
    if (fullPath === "intent_schema") config.intentSchema = value;
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

  const preset = workflowPreset(config.workflowPreset);
  if (!seen.has("intent_schema")) config.intentSchema = preset.schema;
  if (!seen.has("agents.required")) config.requiredAgents = [...preset.roles];
  if (!seen.has("lifecycle.transitions")) config.transitions = structuredClone(preset.transitions);
  if (!seen.has("governance_profiles")) config.approvalGates = Object.fromEntries(Object.entries(DEFAULT_CONFIG.approvalGates).map(([name, gates]) => [name, gates.filter(s => preset.states.includes(s))]));

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
  if (typeof config.observerEnabled !== "boolean") errors.push("observer.enabled must be true or false");
  let preset: ReturnType<typeof workflowPreset>;
  try { preset = workflowPreset(config.workflowPreset); }
  catch (error) { errors.push((error as Error).message); return errors; }
  if (config.intentSchema !== preset.schema) errors.push(`Unsupported intent schema ${config.intentSchema} for workflow preset ${config.workflowPreset}; expected ${preset.schema}`);
  if (!isHarness(config.harness)) errors.push(`Unsupported harness: ${config.harness}`);
  else for (const [role, binding] of Object.entries(config.roleBindings)) errors.push(...bindingErrors(config.harness, role, binding));
  if (!config.approvalGates[config.governanceProfile]) errors.push(`Unknown governance profile: ${config.governanceProfile}`);
  if (!Number.isInteger(config.maxReviewCycles) || config.maxReviewCycles < 1) errors.push("review.max_cycles must be a positive integer");
  for (const agent of config.requiredAgents) {
    if (!/^[a-z][a-z0-9-]*$/.test(agent)) errors.push(`Invalid agent identifier: ${agent}`);
  }
  for (const role of preset.roles) if (!config.requiredAgents.includes(role)) errors.push(`Workflow preset ${config.workflowPreset} requires role: ${role}`);
  if (config.initialStatus !== "backlog") errors.push("Lifecycle initial status must be backlog");
  if (config.terminalStatuses.length !== 2 || !["done", "closed"].every(s => config.terminalStatuses.includes(s as IntentStatus))) errors.push("Lifecycle terminal statuses must be done and closed");
  for (const status of VALID_STATUSES) {
    for (const target of config.transitions[status] ?? []) {
      if (!preset.transitions[status].includes(target)) errors.push(`Unsupported ${config.workflowPreset} lifecycle transition: ${status} -> ${target}`);
    }
  }
  for (const gates of Object.values(config.approvalGates)) for (const gate of gates) if (!preset.states.includes(gate)) errors.push(`Unsupported approval gate ${gate} for workflow preset ${config.workflowPreset}`);
  if (!config.intentBranchPrefix || /[\s\\]|\.\./.test(config.intentBranchPrefix)) errors.push("Invalid intent branch prefix");
  return errors;
}
