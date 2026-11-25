import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { agentPath, instructionPath, isHarness, type Harness } from "./harness";
import { DEFAULT_CONFIG } from "./config";

export const FRAMEWORK_VERSION = "0.3.0";
export const PENDING_PATH = ".aidlc/pending-update.json";
export const UPDATE_LOCK_PATH = ".aidlc/update.lock";
export type UpdateLock = { id: string; pid: number };
export const TRANSACTION_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function readUpdateLock(root: string): UpdateLock | undefined {
  const path = safePath(root, UPDATE_LOCK_PATH);
  if (!existsSync(path)) return undefined;
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!Number.isInteger(value?.pid) || value.pid < 1 || !TRANSACTION_ID.test(value.id)) throw new Error("Invalid update lock; inspect it before recovery");
  return { id: value.id, pid: value.pid };
}
export function processExists(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error: any) { return error.code !== "ESRCH"; }
}
export function pendingTransactionId(root: string): string | undefined {
  const path = safePath(root, PENDING_PATH);
  if (!existsSync(path)) return undefined;
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!TRANSACTION_ID.test(value?.id)) throw new Error("Invalid pending update marker");
  return value.id;
}
export const MANIFEST_PATH = ".aidlc/install.json";
export const BLOCK_START = "<!-- aidlc:begin -->";
export const BLOCK_END = "<!-- aidlc:end -->";
export type ManagedFile = { path: string; sha256: string; kind: "file" | "block" };
export type Manifest = {
  schemaVersion: 1 | 2;
  updateProtocol?: 1;
  frameworkVersion: string;
  configSchemaVersion: 1;
  preset: "default";
  harness: Harness;
  components: { preset: string } & Partial<Record<Harness, string>>;
  managed: ManagedFile[];
  userOwned: string[];
};
export const digest = (text: string) => createHash("sha256").update(text).digest("hex");
function managedPaths(harness: Harness): Map<string, "file" | "block"> {
  return new Map([
    [".aidlc/workflow.md", "file"], [instructionPath(harness), "block"], ["AIDLC.md", "file"],
    ...DEFAULT_CONFIG.requiredAgents.map(role => [agentPath(harness, role), "file"] as const),
  ]);
}
export const USER_PATHS = [".aidlc/config.yaml", ".aidlc/state.json", "intents/", ".aidlc/context/", ".aidlc/observations/", "skills/", ".aidlc/backups/"];

export function safePath(root: string, path: string): string {
  if (isAbsolute(path) || path.includes("\\") || path.split("/").some(p => p === ".." || !p)) throw new Error(`Unsafe managed path: ${path}`);
  const target = resolve(root, path);
  const rel = relative(resolve(root), target);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error(`Path escapes project: ${path}`);
  let current = resolve(root);
  if (!lstatSync(current).isDirectory()) throw new Error("Project root must be a directory");
  for (const segment of path.split("/")) {
    current = join(current, segment);
    try {
      if (lstatSync(current).isSymbolicLink()) throw new Error(`Refusing symbolic link or junction: ${path}`);
    } catch (error: any) { if (error.code !== "ENOENT") throw error; }
  }
  return target;
}

export function ownedBlock(text: string): string {
  const starts = text.split(BLOCK_START).length - 1;
  const ends = text.split(BLOCK_END).length - 1;
  if (starts !== 1 || ends !== 1 || text.indexOf(BLOCK_END) < text.indexOf(BLOCK_START)) throw new Error("Missing or ambiguous AIDLC instruction block");
  return text.slice(text.indexOf(BLOCK_START), text.indexOf(BLOCK_END) + BLOCK_END.length);
}

export function readManifest(root: string): Manifest | undefined {
  const path = safePath(root, MANIFEST_PATH);
  if (!existsSync(path)) return undefined;
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (![1, 2].includes(value?.schemaVersion)) throw new Error(`Unsupported installation manifest schema: ${value?.schemaVersion}`);
  if (!["0.1.0", "0.2.0", FRAMEWORK_VERSION].includes(value.frameworkVersion)) throw new Error(`Unsupported installed framework version: ${value.frameworkVersion}; use a compatible CLI or migration`);
  if (value.schemaVersion !== (value.frameworkVersion === "0.1.0" ? 1 : 2) || (value.schemaVersion === 2 && value.updateProtocol !== 1)) throw new Error("Incompatible installation schema/update protocol");
  const harness = value.harness;
  if (value.configSchemaVersion !== 1 || value.preset !== "default" || !isHarness(harness) || (value.schemaVersion === 1 && harness !== "codex") || !Array.isArray(value.managed) || !Array.isArray(value.userOwned) || !value.userOwned.every((p: unknown) => typeof p === "string" && [...USER_PATHS, "AIDLC.md"].includes(p)) || new Set(value.userOwned).size !== value.userOwned.length || value.components?.preset !== value.frameworkVersion || value.components?.[harness] !== value.frameworkVersion) throw new Error("Invalid or incompatible installation manifest");
  const paths = managedPaths(harness);
  const seen = new Set<string>();
  for (const entry of value.managed) {
    if (typeof entry?.path !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256) || !["file", "block"].includes(entry.kind) || seen.has(entry.path)) throw new Error("Invalid managed-file manifest entry");
    safePath(root, entry.path);
    if (paths.get(entry.path) !== entry.kind || value.userOwned.includes(entry.path)) throw new Error(`Invalid ownership for managed path: ${entry.path}`);
    seen.add(entry.path);
  }
  for (const expected of paths.keys()) {
    if (!seen.has(expected) && !value.userOwned.includes(expected)) throw new Error(`Incomplete installation manifest: ${expected}`);
  }
  return value;
}

export function inspectInstallation(root: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  try {
    const pending = pendingTransactionId(root);
    if (pending) errors.push(`Interrupted update ${pending}; recover with aidlc update --recover ${pending}`);
    const lock = readUpdateLock(root);
    if (lock) errors.push(processExists(lock.pid)
      ? `Update/recovery process is active for transaction ${lock.id}`
      : `Abandoned update lock ${lock.id}; recover with aidlc update --recover ${lock.id}`);
    const manifest = readManifest(root);
    if (!manifest) return { errors, warnings: ["Legacy project: no installation manifest; automatic adoption/update is not available yet."] };
    if (manifest.frameworkVersion !== FRAMEWORK_VERSION) warnings.push(`Installed framework ${manifest.frameworkVersion}; this CLI bundles ${FRAMEWORK_VERSION}. Preview with aidlc update --dry-run.`);
    for (const entry of manifest.managed) {
      const absolute = safePath(root, entry.path);
      if (!existsSync(absolute)) { errors.push(`Missing managed file: ${entry.path}`); continue; }
      const content = readFileSync(absolute, "utf8");
      if (digest(entry.kind === "block" ? ownedBlock(content) : content) !== entry.sha256) errors.push(`Modified managed content: ${entry.path}; preserve changes before update`);
    }
  } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  return { errors, warnings };
}
