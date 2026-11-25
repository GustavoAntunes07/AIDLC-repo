import { readFileSync } from "node:fs";
import { compatibilityErrors } from "./compatibility";
import { digest, FRAMEWORK_VERSION, MANIFEST_PATH, readManifest, safePath, type Manifest } from "./installation";
import { managedPayload } from "./payload";
import { loadProjectConfig } from "./config";
import { agentPath } from "./harness";
import { readPart, runTransaction, type Change, type TransactionResult } from "./transactions";
import type { Resources } from "./init";

export type UpdatePlan = {
  from: string; to: string; migrations: string[];
  actions: { path: string; action: "update" | "keep" | "preserve" | "conflict"; reason?: string }[];
  changes: Change[];
};
export function planUpdate(root: string, resources: Resources, target = FRAMEWORK_VERSION, adaptersOnly = false): UpdatePlan {
  if (target !== FRAMEWORK_VERSION) throw new Error(`This CLI bundles target ${FRAMEWORK_VERSION}; use the matching CLI package for any other version`);
  const incompatible = compatibilityErrors(root);
  if (incompatible.length) throw new Error(incompatible.join("\n"));
  const manifest = readManifest(root);
  if (!manifest) throw new Error("No installation manifest; legacy template adoption is not implemented");
  if (adaptersOnly && manifest.frameworkVersion !== FRAMEWORK_VERSION) throw new Error(`Update the installation to ${FRAMEWORK_VERSION} before syncing adapters`);
  const plan: UpdatePlan = { from: manifest.frameworkVersion, to: target, migrations: manifest.schemaVersion === 1 ? ["installation manifest schema 1 -> 2; update protocol 1"] : [], actions: [], changes: [] };
  const config = loadProjectConfig(root);
  const payload = managedPayload(resources, manifest.harness, config.roleBindings);
  const agentDirectory = agentPath(manifest.harness, "planner").split("/").slice(0, -1).join("/") + "/";
  const hashes = new Map<string, string>();
  for (const entry of manifest.managed) {
    if (adaptersOnly && !entry.path.startsWith(agentDirectory)) continue;
    const desired = payload.get(entry.path);
    if (!desired || desired.kind !== entry.kind) throw new Error(`Unsupported managed resource: ${entry.path}`);
    let current: string;
    try { current = readPart(root, entry); }
    catch (error) { plan.actions.push({ path: entry.path, action: "conflict", reason: error instanceof Error ? error.message : String(error) }); continue; }
    if (digest(current) !== entry.sha256) {
      plan.actions.push({ path: entry.path, action: "conflict", reason: "Managed content differs from its installed baseline" }); continue;
    }
    hashes.set(entry.path, digest(desired.content));
    plan.actions.push({ path: entry.path, action: current === desired.content ? "keep" : "update" });
    if (current !== desired.content) plan.changes.push({ path: entry.path, kind: entry.kind, before: current, after: desired.content });
  }
  for (const path of manifest.userOwned) plan.actions.push({ path, action: "preserve" });
  const next: Manifest = {
    ...manifest, schemaVersion: 2, updateProtocol: 1, frameworkVersion: FRAMEWORK_VERSION,
    components: { preset: FRAMEWORK_VERSION, [manifest.harness]: FRAMEWORK_VERSION },
    userOwned: [...new Set([...manifest.userOwned, ".aidlc/backups/"])],
    managed: manifest.managed.map(entry => ({ ...entry, sha256: hashes.get(entry.path) ?? entry.sha256 })),
  };
  const before = readFileSync(safePath(root, MANIFEST_PATH), "utf8");
  const after = adaptersOnly && !plan.changes.length ? before : JSON.stringify(next, null, 2) + "\n";
  plan.actions.push({ path: MANIFEST_PATH, action: before === after ? "keep" : "update" });
  if (before !== after) plan.changes.push({ path: MANIFEST_PATH, kind: "file", before, after });
  return plan;
}
export function applyUpdate(root: string, resources: Resources, target: string, hooks: { afterWrite?: (path: string, count: number) => void } = {}): TransactionResult {
  return applyPlannedChange(root, () => planUpdate(root, resources, target), "Update", hooks);
}

export function applySync(root: string, resources: Resources): TransactionResult {
  return applyPlannedChange(root, () => planUpdate(root, resources, FRAMEWORK_VERSION, true), "Sync");
}

function applyPlannedChange(root: string, buildPlan: () => UpdatePlan, operation: string, hooks: { afterWrite?: (path: string, count: number) => void } = {}): TransactionResult {
  const initial = buildPlan();
  const conflictPaths = initial.actions.filter(a => a.action === "conflict").map(a => a.path);
  if (conflictPaths.length) throw new Error(`${operation} conflicts; no files changed: ${conflictPaths.join(", ")}`);
  if (!initial.changes.length) return { id: "", changed: false, state: "unchanged" };
  return runTransaction(root, () => {
    const plan = buildPlan();
    if (plan.actions.some(a => a.action === "conflict")) throw new Error(`Managed content changed during ${operation.toLowerCase()} preflight`);
    // A schema/current-release update must always snapshot installation metadata last.
    if (plan.changes.length && plan.changes.at(-1)?.path !== MANIFEST_PATH) {
      const metadata = readFileSync(safePath(root, MANIFEST_PATH), "utf8");
      plan.changes.push({ path: MANIFEST_PATH, kind: "file", before: metadata, after: metadata });
    }
    return plan.changes;
  }, hooks);
}
