import { randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, linkSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { digest, MANIFEST_PATH, ownedBlock, pendingTransactionId, PENDING_PATH, processExists, readManifest, readUpdateLock, safePath, TRANSACTION_ID, UPDATE_LOCK_PATH, type UpdateLock } from "./installation";
import { readUtf8Instructions } from "./encoding";
import { compatibilityErrors } from "./compatibility";

export type Change = { path: string; kind: "file" | "block"; before: string; after: string };
type Snapshot = { schemaVersion: 1; project: string; id: string; changes: Change[] };
type Journal = { schemaVersion: 1; id: string; snapshotHash: string; state: "prepared" | "applying" | "applied" | "rolling_back" | "rolled_back"; completed: number };
export type TransactionResult = { id: string; changed: boolean; state: string };

export function pendingId(root: string): string | undefined {
  return pendingTransactionId(root);
}
function folder(id: string): string {
  if (!TRANSACTION_ID.test(id)) throw new Error("Invalid transaction identifier");
  return `.aidlc/backups/${id}`;
}
function json(value: unknown): string { return JSON.stringify(value, null, 2) + "\n"; }
function atomicWrite(root: string, path: string, text: string): void {
  const absolute = safePath(root, path);
  const temporary = safePath(root, path + "." + randomUUID() + ".tmp");
  mkdirSync(dirname(absolute), { recursive: true });
  let fd: number | undefined;
  try {
    fd = openSync(temporary, "wx");
    writeFileSync(fd, text);
    fsyncSync(fd);
    closeSync(fd); fd = undefined;
    safePath(root, path);
    renameSync(temporary, absolute);
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}
function lock(root: string, id: string, recover = false): (restore?: UpdateLock) => void {
  const path = safePath(root, UPDATE_LOCK_PATH);
  if (existsSync(safePath(root, ".aidlc-init.lock"))) throw new Error("Project initialization is active; retry later");
  if (existsSync(path)) {
    const current = readUpdateLock(root)!;
    if (processExists(current.pid)) throw new Error("Another update/recovery process is active");
    if (!recover || current.id !== id) throw new Error(`Stale update lock for ${current.id}; explicitly recover that transaction`);
    const latest = readUpdateLock(root);
    if (!latest || latest.id !== current.id || latest.pid !== current.pid || processExists(latest.pid)) throw new Error("Update lock ownership changed; retry recovery");
    unlinkSync(path);
  }
  // Publish an already complete record exclusively. A crash cannot leave an empty persistent lock.
  const candidate = safePath(root, UPDATE_LOCK_PATH + "." + randomUUID() + ".tmp");
  let fd: number | undefined;
  try {
    fd = openSync(candidate, "wx");
    writeFileSync(fd, json({ id, pid: process.pid })); fsyncSync(fd);
    closeSync(fd); fd = undefined;
    linkSync(candidate, path);
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(candidate)) unlinkSync(candidate);
  }
  return (restore?: UpdateLock) => {
    const current = readUpdateLock(root);
    if (!current || current.id !== id || current.pid !== process.pid) throw new Error("Update lock ownership changed");
    if (restore) atomicWrite(root, UPDATE_LOCK_PATH, json(restore));
    else unlinkSync(path);
  };
}
export function readPart(root: string, change: Pick<Change, "path" | "kind">): string {
  const path = safePath(root, change.path);
  const content = change.kind === "block" ? readUtf8Instructions(path) : readFileSync(path, "utf8");
  return change.kind === "block" ? ownedBlock(content) : content;
}
function writePart(root: string, change: Change, expected: string, target: string): void {
  const current = readPart(root, change);
  if (current !== expected) throw new Error(`Concurrent managed edit: ${change.path}`);
  const content = change.kind === "block"
    ? readUtf8Instructions(safePath(root, change.path)).replace(current, () => target)
    : target;
  atomicWrite(root, change.path, content);
}

export function runTransaction(root: string, prepare: () => Change[], hooks: { afterWrite?: (path: string, count: number) => void } = {}): TransactionResult {
  const id = randomUUID();
  const release = lock(root, id);
  try {
    if (pendingId(root)) throw new Error(`Interrupted update ${pendingId(root)} requires recovery`);
    const changes = prepare();
    if (!changes.length) return { id, changed: false, state: "unchanged" };
    const backup = folder(id);
    const snapshot: Snapshot = { schemaVersion: 1, project: realpathSync(root), id, changes };
    const snapshotText = json(snapshot);
    const journal: Journal = { schemaVersion: 1, id, snapshotHash: digest(snapshotText), state: "prepared", completed: 0 };
    atomicWrite(root, backup + "/snapshot.json", snapshotText);
    atomicWrite(root, backup + "/journal.json", json(journal));
    atomicWrite(root, PENDING_PATH, json({ id }));
    journal.state = "applying";
    atomicWrite(root, backup + "/journal.json", json(journal));
    try {
      for (const change of changes) {
        writePart(root, change, change.before, change.after);
        journal.completed += 1;
        atomicWrite(root, backup + "/journal.json", json(journal));
        hooks.afterWrite?.(change.path, journal.completed);
      }
      journal.state = "applied";
      atomicWrite(root, backup + "/journal.json", json(journal));
      unlinkSync(safePath(root, PENDING_PATH));
      return { id, changed: true, state: "applied" };
    } catch (error) {
      throw new Error(`Update interrupted; transaction ${id}. Recover with aidlc update --recover ${id}. ${error instanceof Error ? error.message : error}`);
    }
  } finally { release(); }
}

function readBackup(root: string, id: string): { snapshot: Snapshot; journal: Journal } {
  const backup = folder(id);
  const journal = JSON.parse(readFileSync(safePath(root, backup + "/journal.json"), "utf8"));
  const raw = readFileSync(safePath(root, backup + "/snapshot.json"), "utf8");
  if (journal?.schemaVersion !== 1 || journal.id !== id || journal.snapshotHash !== digest(raw) || !["prepared", "applying", "applied", "rolling_back", "rolled_back"].includes(journal.state) || !Number.isInteger(journal.completed)) throw new Error("Invalid transaction journal or snapshot hash");
  const snapshot = JSON.parse(raw);
  if (snapshot?.schemaVersion !== 1 || snapshot.id !== id || snapshot.project !== realpathSync(root) || !Array.isArray(snapshot.changes) || snapshot.changes.length < 1) throw new Error("Invalid backup or project identity");
  const manifest = readManifest(root);
  if (!manifest) throw new Error("Cannot recover a backup without an installation manifest");
  const owned = new Map(manifest.managed.map(entry => [entry.path, entry.kind]));
  const seen = new Set();
  for (const change of snapshot.changes) {
    if (typeof change?.path !== "string" || !["file", "block"].includes(change.kind) || typeof change.before !== "string" || typeof change.after !== "string" || seen.has(change.path) || (change.path === MANIFEST_PATH ? change.kind !== "file" : owned.get(change.path) !== change.kind)) throw new Error("Invalid backup entry");
    safePath(root, change.path);
    seen.add(change.path);
  }
  if (snapshot.changes.at(-1)?.path !== MANIFEST_PATH) throw new Error("Backup must end with installation metadata");
  return { snapshot, journal };
}
function rollbackConflicts(root: string, snapshot: Snapshot): string[] {
  const conflicts: string[] = [];
  for (const change of snapshot.changes) {
    try {
      const current = readPart(root, change);
      if (current !== change.before && current !== change.after) conflicts.push(change.path);
    } catch { conflicts.push(change.path); }
  }
  return conflicts;
}
function assertPreparationBaseline(root: string): void {
  if (pendingId(root)) throw new Error("Cannot discard preparation: a pending update has no readable journal");
  const errors = compatibilityErrors(root, { ignoreUpdateLock: true });
  if (errors.length) throw new Error(errors.join("\n"));
  const manifest = readManifest(root);
  if (!manifest) throw new Error("Cannot establish an installed baseline for preparation recovery");
  for (const entry of manifest.managed) {
    let matches = false;
    try { matches = digest(readPart(root, entry)) === entry.sha256; } catch { /* refuse unknown content */ }
    if (!matches) throw new Error(`Cannot discard preparation: managed baseline differs at ${entry.path}`);
  }
}
function recoverPreparation(root: string, id: string, dryRun: boolean): TransactionResult {
  const receiptPath = folder(id) + "/preparation-recovery.json";
  const original = readUpdateLock(root);
  if (original && original.id !== id) throw new Error(`Another transaction ${original.id} owns the update lock`);
  if (original && processExists(original.pid)) throw new Error("Another update/recovery process is active");
  if (pendingId(root)) throw new Error("Cannot discard preparation: pending update has no readable journal");
  if (existsSync(safePath(root, receiptPath))) {
    const receipt = JSON.parse(readFileSync(safePath(root, receiptPath), "utf8"));
    if (receipt?.schemaVersion !== 1 || receipt.id !== id || receipt.project !== realpathSync(root) || receipt.state !== "preparation_aborted") throw new Error("Invalid preparation recovery receipt");
    if (!original) return { id, changed: false, state: "preparation_aborted" };
  }
  if (!original) throw new Error("No matching abandoned preparation lock or valid recovery receipt");
  assertPreparationBaseline(root);
  if (dryRun) return { id, changed: true, state: "preview" };
  const release = lock(root, id, true);
  let recovered = false;
  try {
    if (existsSync(safePath(root, folder(id) + "/journal.json"))) throw new Error("A journal is present; use full transaction recovery");
    assertPreparationBaseline(root);
    atomicWrite(root, receiptPath, json({ schemaVersion: 1, id, project: realpathSync(root), state: "preparation_aborted", manifestHash: digest(readFileSync(safePath(root, MANIFEST_PATH), "utf8")) }));
    recovered = true;
    return { id, changed: true, state: "preparation_aborted" };
  } finally { release(recovered ? undefined : original); }
}
export function rollback(root: string, id: string, dryRun = false): TransactionResult {
  const pending = pendingId(root);
  if (pending && pending !== id) throw new Error(`Another transaction ${pending} requires recovery first`);
  if (!existsSync(safePath(root, folder(id) + "/journal.json"))) return recoverPreparation(root, id, dryRun);
  const initial = readBackup(root, id);
  const conflicts = rollbackConflicts(root, initial.snapshot);
  if (conflicts.length) throw new Error(`Rollback conflict; preserve local changes: ${conflicts.join(", ")}`);
  if (dryRun) return { id, changed: initial.journal.state !== "rolled_back", state: "preview" };
  if (initial.journal.state === "rolled_back" && !pending) {
    if (initial.snapshot.changes.some(change => readPart(root, change) !== change.before)) throw new Error("This backup was already rolled back; it does not describe the current installation");
    return { id, changed: false, state: "rolled_back" };
  }
  const release = lock(root, id, true);
  try {
    const currentPending = pendingId(root);
    if (currentPending && currentPending !== id) throw new Error(`Another transaction ${currentPending} requires recovery first`);
    const { snapshot, journal } = readBackup(root, id);
    const conflicts = rollbackConflicts(root, snapshot);
    if (conflicts.length) throw new Error(`Rollback conflict: ${conflicts.join(", ")}`);
    journal.state = "rolling_back";
    atomicWrite(root, PENDING_PATH, json({ id }));
    atomicWrite(root, folder(id) + "/journal.json", json(journal));
    // Restore content first and old installation metadata last. Preserve edits outside managed blocks.
    for (const change of snapshot.changes) {
      if (readPart(root, change) === change.after) writePart(root, change, change.after, change.before);
    }
    journal.state = "rolled_back";
    atomicWrite(root, folder(id) + "/journal.json", json(journal));
    unlinkSync(safePath(root, PENDING_PATH));
    return { id, changed: true, state: "rolled_back" };
  } finally { release(); }
}
