import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, normalize, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { compatibilityErrors } from "./compatibility";
import { configErrors, isIntentStatus, loadProjectConfig, VALID_STATUSES, workflowPreset, type AidlcConfig, type IntentStatus } from "./config";
import { safePath } from "./installation";

export const field = (text: string, key: string) => text.match(new RegExp(`^${key}:[ \\t]*([^\\r\\n]*)$`, "m"))?.[1]?.trim();
export function section(text: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`(?:^|\\r?\\n)# ${escaped}[ \\t]*\\r?\\n([\\s\\S]*?)(?=\\r?\\n# |$)`))?.[1]?.trim() ?? "";
}
export type IntentRecord = { file: string; id: string; title: string; status: IntentStatus; branch: string; schema: "full-v1" | "compact-v1"; content: string };
function schemaOf(content: string): IntentRecord["schema"] {
  const schema = field(metadata(content), "schema") ?? "full-v1";
  if (schema !== "full-v1" && schema !== "compact-v1") throw new Error(`Unsupported intent schema: ${schema}`);
  return schema;
}
function checkedConfig(root: string): AidlcConfig {
  const errors = compatibilityErrors(root);
  if (errors.length) throw new Error(errors.join("\n"));
  const config = loadProjectConfig(root);
  return config;
}
function files(root: string): string[] {
  const dir = safePath(root, "intents");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(name => name.endsWith(".md")).sort().map(name => {
    safePath(root, `intents/${name}`);
    return `intents/${name}`;
  });
}
function record(root: string, file: string): IntentRecord {
  const content = readFileSync(safePath(root, file), "utf8");
  const schema = schemaOf(content);
  const meta = metadata(content);
  const status = field(meta, "status");
  if (!isIntentStatus(status)) throw new Error(`${file} has invalid status: ${status}`);
  return { file, id: field(meta, "id") ?? "", title: field(meta, "title") ?? "", status, branch: field(meta, "branch") ?? "", schema, content };
}
function find(root: string, identifier: string): IntentRecord {
  const matches = files(root).map(file => record(root, file)).filter(item => item.id === identifier || basename(item.file) === identifier || normalize(item.file) === normalize(identifier));
  if (matches.length > 1) throw new Error(`Ambiguous intent: ${identifier}`);
  if (!matches.length) throw new Error(`Intent not found: ${identifier}`);
  return matches[0];
}
export function listIntents(root: string): IntentRecord[] { checkedConfig(root); return files(root).map(file => record(root, file)); }
export function showIntent(root: string, identifier: string): IntentRecord { checkedConfig(root); return find(root, identifier); }
function metadata(content: string): string {
  return content.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? "";
}
function validationErrors(content: string, config: AidlcConfig): string[] {
  const errors: string[] = [];
  let schema: IntentRecord["schema"];
  try { schema = schemaOf(content); } catch (error) { return [(error as Error).message]; }
  const meta = metadata(content);
  if (!meta) errors.push("Missing intent frontmatter");
  const required = schema === "full-v1" ? ["id", "title", "status", "story_points", "retry_count", "branch"] : ["id", "title", "type", "status", "branch"];
  for (const key of required) if (!field(meta, key)) errors.push(`is missing field: ${key}`);
  for (const key of [...required, "schema"]) if ((meta.match(new RegExp(`^${key}:`, "gm")) ?? []).length > 1) errors.push(`has duplicate field: ${key}`);
  const status = field(meta, "status");
  if (status && !isIntentStatus(status)) errors.push(`has invalid status: ${status}`);
  if (schema === "compact-v1" && !["feature", "bug", "experiment"].includes(field(meta, "type") ?? "")) errors.push("type must be feature, bug or experiment");
  if (schema === "full-v1") for (const key of ["story_points", "retry_count"]) {
    const value = field(meta, key);
    if (value && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) errors.push(`${key} must be a nonnegative integer`);
  }
  const branch = field(meta, "branch");
  if (branch && branch !== "null" && !branch.startsWith(config.intentBranchPrefix)) errors.push(`branch must start with ${config.intentBranchPrefix}`);
  if (!section(content, schema === "full-v1" ? "Description" : "Objective")) errors.push(`is missing a ${schema === "full-v1" ? "Description" : "Objective"} section body`);
  if (!/- \[[ xX]\] .+/.test(section(content, "Acceptance Criteria"))) errors.push("must define at least one acceptance criterion");
  return errors;
}
export function validateProjectIntents(root: string, config = loadProjectConfig(root)): string[] {
  const errors = [...configErrors(config)];
  try {
    if (!existsSync(safePath(root, "intents"))) return [...errors, "Missing directory: intents"];
    const ids = new Set<string>();
    for (const file of files(root)) {
      const content = readFileSync(safePath(root, file), "utf8");
      errors.push(...validationErrors(content, config).map(error => `${file} ${error}`));
      const id = field(metadata(content), "id");
      if (id && ids.has(id)) errors.push(`Duplicate intent ID: ${id}`);
      if (id) ids.add(id);
    }
  } catch (error) { errors.push((error as Error).message); }
  return errors;
}
export function createIntent(root: string, title: string, options: { type?: string } = {}): IntentRecord {
  const config = checkedConfig(root);
  if (!title.trim() || /[\r\n\0]/.test(title)) throw new Error("Intent title must be a nonempty single line");
  const compact = config.intentSchema === "compact-v1";
  if (options.type && (!compact || !["feature", "bug", "experiment"].includes(options.type))) throw new Error("Intent type is supported only for compact intents and must be feature, bug or experiment");
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
  let shortId = Date.now().toString(36).slice(-4);
  while (existsSync(safePath(root, `intents/INTENT-${shortId}.md`))) shortId = randomBytes(3).toString("hex");
  const file = `intents/INTENT-${shortId}.md`;
  const content = `---\nid: INTENT-${shortId}\ntitle: ${title.trim()}\nstatus: ${config.initialStatus}\n${compact ? `schema: compact-v1\ntype: ${options.type ?? "feature"}` : "story_points: 1\nretry_count: 0"}\nbranch: ${config.intentBranchPrefix}${shortId}-${slug}\n---\n\n# ${compact ? "Objective" : "Description"}\n\n${title.trim()}\n\n${compact ? "# Scope\n\n" : ""}# Acceptance Criteria\n\n- [ ] Define acceptance criteria\n\n${compact ? "# Plan\n\n# Validation\n\n# Review\n" : "# Related Files\n\n# Implementation Notes\n\n# Test Notes\n\n# Review Notes\n\n# Commits\n"}`;
  const path = safePath(root, file);
  mkdirSync(safePath(root, "intents"), { recursive: true });
  writeFileSync(path, content, { flag: "wx" });
  return record(root, file);
}
function gitDirectory(root: string): string | undefined {
  const path = join(root, ".git");
  if (!existsSync(path)) return undefined;
  if (existsSync(join(path, "HEAD"))) return path;
  const gitdir = readFileSync(path, "utf8").trim().match(/^gitdir:\s*(.+)$/)?.[1];
  return gitdir ? resolve(root, gitdir) : undefined;
}
export function checkIntentBranch(root: string, identifier: string) {
  checkedConfig(root);
  const intent = find(root, identifier);
  const requiredBranch = intent.branch === "null" ? "" : intent.branch;
  if (!requiredBranch) throw new Error(`${identifier} does not define a branch.`);
  const gitdir = gitDirectory(root);
  const headPath = gitdir && join(gitdir, "HEAD");
  const head = headPath && existsSync(headPath) ? readFileSync(headPath, "utf8").trim() : "";
  const currentBranch = head.match(/^ref:\s*refs\/heads\/(.+)$/)?.[1];
  const commonPath = gitdir && join(gitdir, "commondir");
  const common = commonPath && existsSync(commonPath) ? resolve(gitdir!, readFileSync(commonPath, "utf8").trim()) : gitdir;
  const packedPath = common && join(common, "packed-refs");
  const exists = Boolean(common && (existsSync(join(common, "refs", "heads", requiredBranch)) || (packedPath && existsSync(packedPath) && readFileSync(packedPath, "utf8").split(/\r?\n/).some(line => line.endsWith(` refs/heads/${requiredBranch}`)))));
  return { requiredBranch, currentBranch, exists, matches: currentBranch === requiredBranch, suggestion: `git switch${exists ? "" : " -c"} ${requiredBranch}` };
}
function updateField(content: string, key: string, value: string): string {
  const meta = metadata(content);
  const pattern = new RegExp(`^${key}:[^\\r\\n]*`, "m");
  if (!pattern.test(meta)) throw new Error(`Missing field: ${key}`);
  return content.replace(meta, () => meta.replace(pattern, () => `${key}: ${value}`));
}
function guardEvidence(intent: IntentRecord, to: IntentStatus): string[] {
  const errors: string[] = [], compact = intent.schema === "compact-v1", text = intent.content;
  if (to === "context_ready") {
    for (const heading of compact ? ["Objective", "Scope", "Plan"] : ["Description", "Related Files"]) if (!section(text, heading)) errors.push(`Definition of Ready requires ${heading.toLowerCase()}.`);
    if (!/- \[[ xX]\] .+/.test(section(text, "Acceptance Criteria"))) errors.push("Definition of Ready requires acceptance criteria.");
  }
  if (to === "done" || to === "approved") {
    const criteria = section(text, "Acceptance Criteria").match(/- \[[ xX]\] .+/g) ?? [];
    if (!criteria.length || criteria.some(item => !/^- \[[xX]\]/.test(item))) errors.push("Definition of Done requires all acceptance criteria to be checked.");
    if (!section(text, compact ? "Validation" : "Test Notes")) errors.push(`Definition of Done requires ${compact ? "validation evidence" : "test notes"}.`);
    const review = section(text, compact ? "Review" : "Review Notes");
    // Earlier rejected cycles remain useful history; require the latest explicit decision.
    const decisions = [...review.matchAll(/(?:^|[\r\n.!?])[ \t]*(?:[-*][ \t]+)?(NOT APPROVED|PENDING APPROVAL|APPROVED|REJECTED)\b/gi)];
    if (decisions.at(-1)?.[1].toUpperCase() !== "APPROVED") errors.push(`Definition of Done requires reviewer approval in ${compact ? "Review" : "Review Notes"}.`);
  }
  return errors;
}
export function transitionIntent(root: string, identifier: string, target: string) {
  const config = checkedConfig(root);
  if (!isIntentStatus(target)) throw new Error(`Invalid target status: ${target}`);
  const intent = find(root, identifier);
  const errors = validationErrors(intent.content, config);
  const preset = workflowPreset(config.workflowPreset);
  let allowed = config.transitions[intent.status];
  if (!preset.states.includes(intent.status) && !["closed", "escalated"].includes(target)) errors.push(`Intent state ${intent.status} is unsupported by ${config.workflowPreset}; finish under default or explicitly migrate the intent`);
  if (!preset.states.includes(intent.status) && ["closed", "escalated"].includes(target) && !["done", "closed"].includes(intent.status)) allowed = ["closed", "escalated"];
  if (!allowed?.includes(target)) errors.push(`Invalid transition for ${identifier}: ${intent.status} -> ${target}\nAllowed: ${allowed?.join(", ") || "(none)"}`);
  errors.push(...guardEvidence(intent, target));
  if (target === "in_development" && config.enforceIntentBranch) {
    const branch = checkIntentBranch(root, identifier);
    if (!branch.matches) errors.push(`Intent branch mismatch. Current branch is ${branch.currentBranch ?? "unknown"}; required branch is ${branch.requiredBranch}.\nRun: ${branch.suggestion}`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  writeFileSync(safePath(root, intent.file), updateField(intent.content, "status", target));
  return { from: intent.status, to: target, approvalRequired: config.approvalGates[config.governanceProfile]?.includes(target) ?? false, profile: config.governanceProfile };
}
export function closeIntent(root: string, identifier: string, reason = "") {
  const config = checkedConfig(root), intent = find(root, identifier);
  if (intent.status === "done") throw new Error(`Cannot close terminal intent: ${intent.status}`);
  if (/[\r\n\0]/.test(reason)) throw new Error("Close reason must be a single line");
  if (intent.status !== "closed") transitionIntent(root, identifier, "closed");
  if (reason.trim()) {
    const current = find(root, identifier);
    const meta = metadata(current.content);
    const content = field(meta, "closed_reason") !== undefined ? updateField(current.content, "closed_reason", reason.trim()) : current.content.replace(meta, () => meta + `\nclosed_reason: ${reason.trim()}`);
    writeFileSync(safePath(root, current.file), content);
  }
  return { from: intent.status, to: "closed" as IntentStatus, approvalRequired: config.approvalGates[config.governanceProfile]?.includes("closed") ?? false, profile: config.governanceProfile };
}
export function intentStatus(root: string): Record<string, number> {
  const counts = Object.fromEntries(VALID_STATUSES.map(status => [status, 0]));
  for (const intent of listIntents(root)) counts[intent.status]++;
  return counts;
}
export function nextIntent(root: string): IntentRecord | undefined {
  const priority = ["review", "ready_for_testing", "in_development", "context_ready", "backlog"];
  return listIntents(root).filter(intent => priority.includes(intent.status)).sort((a, b) => priority.indexOf(a.status) - priority.indexOf(b.status))[0];
}
