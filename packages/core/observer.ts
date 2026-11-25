import { randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { compatibilityErrors } from "./compatibility";
import { readUtf8Instructions } from "./encoding";
import { loadProjectConfig } from "./config";
import { checkIntentBranch, section, showIntent } from "./intents";
import { digest, processExists, safePath } from "./installation";

const STORE = ".aidlc/observations";
const LOCK = STORE + "/operation.lock";
const HASH = /^[a-f0-9]{64}$/;
const MAX_SKILL_BYTES = 100_000;
const MAX_RECORD_BYTES = 1024 * 1024;
const SLUG = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/;
const SKILL = /^skills\/[a-z][a-z0-9-]{0,79}\/SKILL\.md$/;
type Data = Record<string, any>;
type Kind = "observation" | "session" | "proposal";
type Envelope = { schemaVersion: 1; kind: Kind; id: string; createdAt: string; hash: string; payload: Data };
type OperationLock = { schemaVersion: 1; token: string; proposal: string; pid: number; project: string };
export type ObserverHooks = { afterPrepared?: () => void; afterSkillWrite?: () => void };
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const canonical = (value: unknown) => JSON.stringify(value);
const now = () => new Date().toISOString();

function object(value: unknown, fields: string[]): asserts value is Data {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Observer input must be an object");
  for (const key of Object.keys(value)) if (!fields.includes(key)) throw new Error("Unknown observer field: " + key);
  for (const key of fields) if (!Object.hasOwn(value, key)) throw new Error("Missing observer field: " + key);
}
function text(value: unknown, name: string, max = 2000, multiline = false): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max || Buffer.from(value, "utf8").toString("utf8") !== value || (multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/ : /[\x00-\x1f\x7f]/).test(value)) throw new Error("Invalid observer " + name);
}
function skillText(value: string, name: string) {
  if (Buffer.byteLength(value, "utf8") > MAX_SKILL_BYTES || Buffer.from(value, "utf8").toString("utf8") !== value || value.includes("\0")) throw new Error("Invalid observer " + name + "; skill content must be valid UTF-8 within " + MAX_SKILL_BYTES + " bytes");
}
function identifier(value: unknown, name: string): asserts value is string {
  text(value, name, 120);
  if (!SLUG.test(value)) throw new Error("Invalid observer " + name);
}
function intentIdentifier(value: unknown): asserts value is string {
  text(value, "intent", 120);
  if (!/^INTENT-[A-Za-z0-9-]+$/.test(value)) throw new Error("Invalid observer intent");
}
function secretCheck(value: string) {
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,}|(?:password|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*["']?[A-Za-z0-9+/=_-]{8,}|Bearer\s+[A-Za-z0-9._-]{12,}|https?:\/\/[^\s]+[?&](?:token|key|secret|password)=/i.test(value)) throw new Error("Observer content contains a possible credential; sanitize it before capture");
}
function captureInput(value: unknown) {
  object(value, ["schemaVersion", "session", "intent", "occurrence", "category", "evidence", "skill", "suggestion", "sanitized"]);
  if (value.schemaVersion !== 1 || value.sanitized !== true) throw new Error("Observer requires schemaVersion 1 and sanitized: true");
  identifier(value.session, "session"); intentIdentifier(value.intent); identifier(value.occurrence, "occurrence");
  if (!["correction", "workflow", "limitation", "skill-gap"].includes(value.category)) throw new Error("Invalid observer category");
  text(value.evidence, "evidence"); text(value.skill, "skill", 200); text(value.suggestion, "suggestion");
  secretCheck([value.evidence, value.skill, value.suggestion].join("\n"));
  return { schemaVersion: 1, session: value.session, intent: value.intent, occurrence: value.occurrence, category: value.category, evidence: value.evidence, skill: value.skill, suggestion: value.suggestion, sanitized: true };
}
function stageInput(value: unknown) {
  object(value, ["schemaVersion", "intent", "observations", "target", "kind", "candidate"]);
  if (value.schemaVersion !== 1 || !["project", "companion"].includes(value.kind)) throw new Error("Invalid proposal schema or kind");
  intentIdentifier(value.intent);
  if (!Array.isArray(value.observations) || !value.observations.length || value.observations.length > 100 || new Set(value.observations).size !== value.observations.length || value.observations.some((id: unknown) => typeof id !== "string" || !/^obs-[a-f0-9]{64}$/.test(id))) throw new Error("Proposal requires unique observation identifiers");
  text(value.target, "target", 200); text(value.candidate, "candidate", MAX_SKILL_BYTES, true);
  skillText(value.candidate, "candidate");
  if (value.kind === "project" && !SKILL.test(value.target)) throw new Error("Project proposal target must be skills/<name>/SKILL.md");
  secretCheck(value.candidate);
  return { schemaVersion: 1, intent: value.intent, observations: [...value.observations].sort(), target: value.target, kind: value.kind, candidate: value.candidate };
}
function readJson(root: string, path: string) {
  const absolute = safePath(root, path), stat = lstatSync(absolute);
  if (!stat.isFile() || stat.size > MAX_RECORD_BYTES) throw new Error("Expected bounded regular observer file: " + path);
  return JSON.parse(readFileSync(absolute, "utf8"));
}
function guard(root: string, enabled = false) {
  const errors = compatibilityErrors(root);
  if (errors.length) throw new Error(errors.join("\n"));
  if (enabled && !loadProjectConfig(root).observerEnabled) throw new Error("Observer capture is disabled; set observer.enabled: true explicitly");
}
function sourceIntent(root: string, id: string) {
  intentIdentifier(id);
  const intent = showIntent(root, id);
  if (["done", "closed", "escalated"].includes(intent.status)) throw new Error("Observer source intent is not active: " + id);
  return intent;
}
function timestamp(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) || new Date(value).toISOString() !== value) throw new Error("Invalid observer timestamp");
}
function sessionPayload(value: unknown) {
  object(value, ["session", "intent"]); identifier(value.session, "session"); intentIdentifier(value.intent);
  return { session: value.session, intent: value.intent };
}
function recordId(kind: Kind, payload: Data) {
  return kind === "observation" ? "obs-" + digest(canonical([payload.session, payload.occurrence])) : kind + "-" + digest(canonical(payload));
}
function recordPath(kind: Kind, id: string) {
  const prefix = kind === "observation" ? "obs-" : kind + "-";
  if (!id.startsWith(prefix) || !HASH.test(id.slice(prefix.length))) throw new Error("Invalid observer record identifier");
  return STORE + "/" + (kind === "observation" ? "records" : kind === "session" ? "sessions" : "proposals") + "/" + id + ".json";
}
function diff(base: string | null, candidate: string, target: string) {
  // A complete replacement hunk keeps every removed and added line reviewable.
  const before = base === null ? [] : base.split("\n"), after = candidate.split("\n");
  return "--- " + (base === null ? "/dev/null" : target) + "\n+++ " + target + "\n@@ -" + (before.length ? 1 : 0) + "," + before.length + " +1," + after.length + " @@\n" + before.map(line => "-" + line).concat(after.map(line => "+" + line)).join("\n") + "\n";
}
function proposalPayload(value: unknown) {
  object(value, ["schemaVersion", "intent", "observations", "target", "kind", "candidate", "base", "baseHash", "candidateHash", "diff"]);
  const { base, baseHash, candidateHash, diff: rendered, ...input } = value;
  const stage = stageInput(input);
  if (base !== null) {
    if (typeof base !== "string") throw new Error("Invalid proposal baseline");
    skillText(base, "proposal baseline");
  }
  if (stage.kind === "companion" && base !== null) throw new Error("Companion proposal cannot own a baseline");
  if (baseHash !== (base === null ? null : digest(base)) || candidateHash !== digest(stage.candidate) || rendered !== diff(base, stage.candidate, stage.target)) throw new Error("Proposal content hashes or diff do not match");
  return { ...stage, base, baseHash, candidateHash, diff: rendered };
}
function validateRecord(value: unknown, kind: Kind, id: string): Envelope {
  object(value, ["schemaVersion", "kind", "id", "createdAt", "hash", "payload"]);
  const payload = kind === "observation" ? captureInput(value.payload) : kind === "session" ? sessionPayload(value.payload) : proposalPayload(value.payload);
  timestamp(value.createdAt);
  if (value.schemaVersion !== 1 || value.kind !== kind || value.id !== id || recordId(kind, payload) !== id || value.hash !== digest(canonical(payload))) throw new Error("Invalid observer " + kind + " identity or hash");
  return { schemaVersion: 1, kind, id, createdAt: value.createdAt, hash: value.hash, payload };
}
function readRecord(root: string, kind: Kind, id: string) {
  return validateRecord(readJson(root, recordPath(kind, id)), kind, id);
}
function atomicWrite(root: string, path: string, content: string, exclusive: boolean, baseline?: string | null) {
  const target = safePath(root, path), temporary = safePath(root, path + "." + randomUUID() + ".tmp");
  mkdirSync(dirname(target), { recursive: true });
  let fd: number | undefined;
  try {
    fd = openSync(temporary, "wx"); writeFileSync(fd, content); fsyncSync(fd); closeSync(fd); fd = undefined;
    safePath(root, path);
    if (baseline !== undefined && readSkill(root, path) !== baseline) throw new Error("Concurrent skill edit; recover this application");
    if (exclusive) linkSync(temporary, target); else renameSync(temporary, target);
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}
function publish(root: string, kind: Kind, payload: Data) {
  const id = recordId(kind, payload), hash = digest(canonical(payload));
  const record: Envelope = { schemaVersion: 1, kind, id, createdAt: now(), hash, payload };
  const content = json(record);
  if (Buffer.byteLength(content, "utf8") > MAX_RECORD_BYTES) throw new Error("Observer record exceeds " + MAX_RECORD_BYTES + " UTF-8 bytes; reduce the proposal or evidence");
  try { atomicWrite(root, recordPath(kind, id), content, true); }
  catch (error: any) {
    if (error.code !== "EEXIST") throw error;
    const previous = readRecord(root, kind, id);
    if (previous.hash !== hash) throw new Error("Observer occurrence conflict: " + id);
    return { ...previous, duplicate: true };
  }
  return { ...record, duplicate: false };
}
function listRecords(root: string, kind: Kind) {
  const folder = STORE + "/" + (kind === "observation" ? "records" : kind === "session" ? "sessions" : "proposals");
  const absolute = safePath(root, folder);
  if (!existsSync(absolute)) return [];
  if (!lstatSync(absolute).isDirectory()) throw new Error("Expected observer directory: " + folder);
  return readdirSync(absolute).filter(name => name.endsWith(".json")).sort().map(name => readRecord(root, kind, name.slice(0, -5)));
}
function readSkill(root: string, target: string): string | null {
  if (!SKILL.test(target)) throw new Error("Skill target is outside project-owned skills");
  const path = safePath(root, target);
  if (!existsSync(path)) return null;
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > MAX_SKILL_BYTES) throw new Error("Skill target must be a bounded, unlinked regular file");
  return readUtf8Instructions(path);
}
function readLock(root: string): OperationLock | undefined {
  if (!existsSync(safePath(root, LOCK))) return undefined;
  const value = readJson(root, LOCK);
  object(value, ["schemaVersion", "token", "proposal", "pid", "project"]);
  if (value.schemaVersion !== 1 || typeof value.token !== "string" || !/^[a-f0-9-]{36}$/.test(value.token) || !/^proposal-[a-f0-9]{64}$/.test(value.proposal) || !Number.isInteger(value.pid) || value.pid < 1 || value.project !== realpathSync(root)) throw new Error("Invalid observer operation lock");
  return value as OperationLock;
}
function operation(root: string, proposal: string, recover = false) {
  const previous = readLock(root);
  if (previous) {
    if (processExists(previous.pid)) throw new Error("Observer operation is active");
    if (!recover || previous.proposal !== proposal) throw new Error("Abandoned observer operation; recover " + previous.proposal + " explicitly");
    const current = readLock(root)!;
    if (current.token !== previous.token || processExists(current.pid)) throw new Error("Observer lock ownership changed");
    unlinkSync(safePath(root, LOCK));
  }
  const lock: OperationLock = { schemaVersion: 1, token: randomUUID(), proposal, pid: process.pid, project: realpathSync(root) };
  atomicWrite(root, LOCK, json(lock), true);
  return () => {
    if (readLock(root)?.token !== lock.token) throw new Error("Observer lock ownership changed");
    unlinkSync(safePath(root, LOCK));
  };
}
function reviews(root: string, proposal: Envelope): Data[] {
  const directory = STORE + "/reviews/" + proposal.id, path = safePath(root, directory);
  if (!existsSync(path)) return [];
  const output: Data[] = [];
  for (const name of readdirSync(path).filter(name => name.endsWith(".json")).sort()) {
    const value = readJson(root, directory + "/" + name);
    object(value, ["schemaVersion", "proposal", "hash", "sequence", "previous", "decision", "reviewer", "note", "createdAt", "eventHash"]);
    const { eventHash, ...payload } = value;
    const sequence = output.length + 1;
    timestamp(value.createdAt); identifier(value.reviewer, "reviewer"); text(value.note, "review note");
    if (name !== String(sequence).padStart(8, "0") + ".json" || value.schemaVersion !== 1 || value.proposal !== proposal.id || value.hash !== proposal.hash || value.sequence !== sequence || value.previous !== (output.at(-1)?.eventHash ?? null) || !["approved", "rejected"].includes(value.decision) || eventHash !== digest(canonical(payload))) throw new Error("Invalid observer review chain");
    output.push(value);
  }
  return output;
}
function proposalView(root: string, id: string) {
  const proposal = readRecord(root, "proposal", id);
  for (const observation of proposal.payload.observations) readRecord(root, "observation", observation);
  return { ...proposal, reviews: reviews(root, proposal), reviewEvidence: "manually asserted; independent context is not verified by this CLI" };
}
function observationView(root: string, record: Envelope) {
  const linked = listRecords(root, "proposal").filter(proposal => proposal.payload.observations.includes(record.id)).map(proposal => {
    const history = reviews(root, proposal);
    const application = readApplication(root, proposal);
    return { id: proposal.id, reviewStatus: application?.state === "applied" ? "applied" : history.at(-1)?.decision ?? "pending" };
  });
  // Multiple competing proposals have separate review states; no observation is silently marked resolved.
  return { ...record, reviewStatus: linked.length ? "proposed" : "pending", proposals: linked };
}
function applicationPath(id: string) {
  if (!/^proposal-[a-f0-9]{64}$/.test(id)) throw new Error("Invalid proposal identifier");
  return STORE + "/applications/" + id + ".json";
}
function readApplication(root: string, proposal: Envelope): Data | undefined {
  const path = applicationPath(proposal.id);
  if (!existsSync(safePath(root, path))) return undefined;
  const value = readJson(root, path);
  object(value, ["schemaVersion", "project", "proposal", "hash", "target", "baseHash", "candidateHash", "state"]);
  const p = proposal.payload;
  if (value.schemaVersion !== 1 || value.project !== realpathSync(root) || value.proposal !== proposal.id || value.hash !== proposal.hash || value.target !== p.target || !SKILL.test(value.target) || value.baseHash !== p.baseHash || value.candidateHash !== p.candidateHash || !["prepared", "applied", "rolled_back"].includes(value.state)) throw new Error("Invalid observer application journal");
  return value;
}
function requireHash(proposal: Envelope, hash: string | undefined) {
  if (!hash || !HASH.test(hash) || hash !== proposal.hash) throw new Error("Explicit authorization must name the exact proposal hash");
}
function skillIntent(root: string, proposal: Envelope, applying: boolean) {
  const intent = sourceIntent(root, proposal.payload.intent);
  if (!["review", "approved"].includes(intent.status)) throw new Error("Skill proposal requires its linked intent in review or approved");
  if (loadProjectConfig(root).enforceIntentBranch && !checkIntentBranch(root, intent.id).matches) throw new Error("Skill proposal intent branch mismatch");
  if (applying) {
    const note = section(intent.content, intent.schema === "compact-v1" ? "Review" : "Review Notes");
    const decisions = [...note.matchAll(/(?:^|[\r\n.!?])[ \t]*(?:[-*][ \t]+)?(NOT APPROVED|PENDING APPROVAL|APPROVED|REJECTED)\b/gi)];
    if ((intent.schema === "full-v1" && intent.status !== "approved") || decisions.at(-1)?.[1].toUpperCase() !== "APPROVED") throw new Error("Linked intent requires recorded independent review approval before applying a skill");
  }
}
function session(root: string, session: string, intent: string) {
  guard(root, true); const payload = sessionPayload({ session, intent }); sourceIntent(root, intent);
  return publish(root, "session", payload);
}
function capture(root: string, input: unknown) {
  guard(root, true); const payload = captureInput(input); sourceIntent(root, payload.intent);
  readRecord(root, "session", recordId("session", { session: payload.session, intent: payload.intent }));
  return { ...publish(root, "observation", payload), reviewStatus: "pending" };
}
function stage(root: string, input: unknown) {
  guard(root, true); const payload = stageInput(input); sourceIntent(root, payload.intent);
  for (const id of payload.observations) readRecord(root, "observation", id);
  const base = payload.kind === "project" ? readSkill(root, payload.target) : null;
  if (base !== null) secretCheck(base);
  if (base === payload.candidate) throw new Error("Proposal has no changes");
  return publish(root, "proposal", { ...payload, base, baseHash: base === null ? null : digest(base), candidateHash: digest(payload.candidate), diff: diff(base, payload.candidate, payload.target) });
}
function review(root: string, id: string, options: Record<string, string>) {
  guard(root, true);
  const proposal = readRecord(root, "proposal", id); requireHash(proposal, options.hash); skillIntent(root, proposal, false);
  if (!["approved", "rejected"].includes(options.decision)) throw new Error("Review decision must be approved or rejected");
  identifier(options.reviewer, "reviewer"); text(options.note, "review note"); secretCheck(options.note);
  const sourceSessions = proposal.payload.observations.map((observation: string) => readRecord(root, "observation", observation).payload.session);
  if (sourceSessions.includes(options.reviewer)) throw new Error("Reviewer must identify a separate context from observation capture");
  const release = operation(root, id);
  try {
    const journal = readApplication(root, proposal);
    if (journal && journal.state !== "rolled_back") throw new Error("Cannot change review during or after application");
    const history = reviews(root, proposal);
    const payload = { schemaVersion: 1, proposal: id, hash: proposal.hash, sequence: history.length + 1, previous: history.at(-1)?.eventHash ?? null, decision: options.decision, reviewer: options.reviewer, note: options.note, createdAt: now() };
    const event = { ...payload, eventHash: digest(canonical(payload)) };
    atomicWrite(root, STORE + "/reviews/" + id + "/" + String(payload.sequence).padStart(8, "0") + ".json", json(event), true);
    return { ...event, reviewEvidence: "manually asserted; verify independent context outside this CLI" };
  } finally { release(); }
}
function apply(root: string, id: string, authorization: string, hooks: ObserverHooks) {
  guard(root, true);
  const proposal = readRecord(root, "proposal", id), p = proposal.payload;
  requireHash(proposal, authorization);
  if (p.kind !== "project") throw new Error("Companion proposals cannot overwrite external, system or plugin skills");
  skillIntent(root, proposal, true);
  const release = operation(root, id);
  try {
    if (reviews(root, proposal).at(-1)?.decision !== "approved") throw new Error("The exact proposal needs an approved review");
    const journal = readApplication(root, proposal);
    if (journal?.state === "prepared") throw new Error("Interrupted skill application; recover " + id + " first");
    const current = readSkill(root, p.target);
    if (journal?.state === "applied") {
      if (current !== p.candidate) throw new Error("Applied skill was modified; preserve local changes");
      return { proposal: id, state: "applied", changed: false };
    }
    if (current !== p.base) throw new Error("Skill baseline conflict; stage and review a fresh proposal");
    const next = { schemaVersion: 1, project: realpathSync(root), proposal: id, hash: proposal.hash, target: p.target, baseHash: p.baseHash, candidateHash: p.candidateHash, state: "prepared" };
    atomicWrite(root, applicationPath(id), json(next), false);
    hooks.afterPrepared?.();
    if (readSkill(root, p.target) !== p.base) throw new Error("Concurrent skill edit; recover this application");
    atomicWrite(root, p.target, p.candidate, p.base === null, p.base);
    hooks.afterSkillWrite?.();
    next.state = "applied"; atomicWrite(root, applicationPath(id), json(next), false);
    return { proposal: id, state: "applied", changed: true };
  } finally { release(); }
}
function recover(root: string, id: string, authorization: string) {
  // Recovery remains available after disabling capture or closing the source intent.
  guard(root);
  const proposal = readRecord(root, "proposal", id), p = proposal.payload;
  requireHash(proposal, authorization);
  const existing = readApplication(root, proposal), previous = readLock(root);
  if (!existing && (!previous || previous.proposal !== id)) throw new Error("No skill application or abandoned operation to recover");
  if (existing && p.kind !== "project") throw new Error("Only project skill applications can be recovered");
  const release = operation(root, id, true);
  try {
    const journal = readApplication(root, proposal);
    if (!journal) return { proposal: id, state: "preparation_aborted", changed: false };
    const current = readSkill(root, p.target);
    if (journal.state === "applied") {
      if (current !== p.candidate) throw new Error("Applied skill was modified; preserve local changes");
      return { proposal: id, state: "applied", changed: false };
    }
    if (journal.state === "rolled_back") {
      if (current !== p.base) throw new Error("Recovered skill no longer matches its original baseline");
      return { proposal: id, state: "rolled_back", changed: false };
    }
    if (current !== p.base && current !== p.candidate) throw new Error("Skill recovery conflict; preserve local changes");
    if (current === p.candidate) {
      if (p.base === null) unlinkSync(safePath(root, p.target));
      else atomicWrite(root, p.target, p.base, false, p.candidate);
    }
    journal.state = "rolled_back"; atomicWrite(root, applicationPath(id), json(journal), false);
    return { proposal: id, state: "rolled_back", changed: current !== p.base };
  } finally { release(); }
}
function exportProposal(root: string, id: string, file: string, output: string) {
  guard(root);
  const proposal = readRecord(root, "proposal", id), value = readJson(root, file);
  object(value, ["schemaVersion", "title", "evidence", "suggestion", "sanitized", "generalized"]);
  if (value.schemaVersion !== 1 || value.sanitized !== true || value.generalized !== true) throw new Error("Export requires sanitized and generalized content explicitly");
  text(value.title, "export title", 200); text(value.evidence, "export evidence"); text(value.suggestion, "export suggestion");
  secretCheck([value.title, value.evidence, value.suggestion].join("\n"));
  if (!/^\.aidlc\/observations\/exports\/[a-z][a-z0-9-]{0,79}\.json$/.test(output)) throw new Error("Export destination must be .aidlc/observations/exports/<name>.json");
  // Only the explicitly generalized text is exported, without private provenance.
  const content = { schemaVersion: 1, title: value.title, evidence: value.evidence, suggestion: value.suggestion, sanitized: true, generalized: true };
  atomicWrite(root, output, json(content), true);
  return { path: output, sourceProposal: proposal.id, published: false };
}
export function inspectObserver(root: string) {
  const result = { errors: [] as string[], warnings: [] as string[], enabled: false, mode: "session-guided", automaticHooks: "unavailable", lastSession: null as null | { session: string; intent: string; reportedAt: string }, lastCapture: null as null | { id: string; capturedAt: string }, observations: 0, proposals: 0 };
  try {
    result.enabled = loadProjectConfig(root).observerEnabled;
    const sessions = listRecords(root, "session").sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const records = listRecords(root, "observation").sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const proposals = listRecords(root, "proposal");
    result.observations = records.length; result.proposals = proposals.length;
    const last = sessions.at(-1), capture = records.at(-1);
    if (last) result.lastSession = { session: last.payload.session, intent: last.payload.intent, reportedAt: last.createdAt };
    if (capture) result.lastCapture = { id: capture.id, capturedAt: capture.createdAt };
    for (const record of records) readRecord(root, "session", recordId("session", { session: record.payload.session, intent: record.payload.intent }));
    for (const proposal of proposals) {
      proposalView(root, proposal.id);
      if (readApplication(root, proposal)?.state === "prepared") result.errors.push("Interrupted observer application " + proposal.id + "; use observer proposal recover with its exact hash");
    }
    const lock = readLock(root);
    if (lock) result.errors.push(processExists(lock.pid) ? "Observer operation is active" : "Abandoned observer operation " + lock.proposal + "; explicit recovery required");
    if (result.enabled) result.warnings.push(last ? "Observer activity is manually reported; automatic activation and continuous execution are unverified." : "Observer enabled but no session checkpoint exists; activity is unverified.");
  } catch (error) { result.errors.push(error instanceof Error ? error.message : String(error)); }
  return result;
}
function options(args: string[], allowed: string[]) {
  const output: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    if (!args[i].startsWith("--") || !allowed.includes(key) || Object.hasOwn(output, key) || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error("Invalid observer option: " + args[i]);
    output[key] = args[i + 1];
  }
  for (const key of allowed) if (!Object.hasOwn(output, key)) throw new Error("Observer requires --" + key);
  return output;
}
export function runObserver(root: string, args: string[], hooks: ObserverHooks = {}): unknown {
  guard(root);
  const [command, ...rest] = args;
  if (command === "status" && !rest.length) return inspectObserver(root);
  if (command === "session") { const o = options(rest, ["session", "intent"]); return session(root, o.session, o.intent); }
  if (command === "capture") { const o = options(rest, ["file"]); return capture(root, readJson(root, o.file)); }
  if (command === "list" && !rest.length) return { observations: listRecords(root, "observation").map(record => observationView(root, record)), proposals: listRecords(root, "proposal").map(proposal => ({ id: proposal.id, hash: proposal.hash, target: proposal.payload.target, reviewStatus: reviews(root, proposal).at(-1)?.decision ?? "pending" })) };
  if (command === "show" && rest.length === 1) return observationView(root, readRecord(root, "observation", rest[0]));
  if (command === "proposal") {
    const [action, ...values] = rest, [id, ...flags] = values;
    if (action === "stage") { const o = options(values, ["file"]); return stage(root, readJson(root, o.file)); }
    if (action === "show" && id && !flags.length) return proposalView(root, id);
    if (action === "review" && id) return review(root, id, options(flags, ["decision", "reviewer", "hash", "note"]));
    if (action === "apply" && id) return apply(root, id, options(flags, ["authorize"]).authorize, hooks);
    if (action === "recover" && id) return recover(root, id, options(flags, ["authorize"]).authorize);
    if (action === "export" && id) { const o = options(flags, ["file", "output"]); return exportProposal(root, id, o.file, o.output); }
  }
  throw new Error("Usage: aidlc observer status|session|capture|list|show|proposal stage|show|review|apply|recover|export");
}
