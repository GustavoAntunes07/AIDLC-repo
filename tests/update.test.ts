import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const node = Bun.which("node")!;
const current = join(repo, "dist/aidlc.js");
let fixtureRoot: string, workspace: string, oldCli: string;
function execute(entry: string, args: string[], root = workspace) {
  const result = spawnSync(node, [entry, ...args], { cwd: root, encoding: "utf8" });
  if (result.error) throw result.error;
  return { code: result.status, text: result.stdout + result.stderr };
}
const cli = (...args: string[]) => execute(current, args);
function snapshot(root: string, backups = true): Record<string, string> {
  const result: Record<string, string> = {};
  for (const child of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, child.name);
    if (!backups && resolve(path) === resolve(workspace, ".aidlc/backups")) continue;
    if (child.isSymbolicLink()) result[child.name] = "link:" + readlinkSync(path);
    else if (child.isDirectory()) for (const [key, value] of Object.entries(snapshot(path, backups))) result[child.name + "/" + key] = value;
    else result[child.name] = readFileSync(path).toString("base64");
  }
  return result;
}
function write(path: string, text: string) {
  const absolute = join(workspace, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, text);
}
function upgrade() {
  const result = cli("update", "--to", "0.2.0");
  expect(result.code).toBe(0);
  return JSON.parse(result.text) as { id: string; state: string; changed: boolean };
}
function interruptPreparation(): { id: string; pid: number } {
  const script = join(fixtureRoot, "crash-preflight.ts");
  writeFileSync(script, `import { runTransaction } from ${JSON.stringify(pathToFileURL(join(repo, "packages/core/transactions.ts")).href)};\nrunTransaction(process.argv[2], () => { process.exit(73); });\n`);
  const crashed = Bun.spawnSync({ cmd: [Bun.which("bun")!, script, workspace], stdout: "pipe", stderr: "pipe" });
  expect(crashed.exitCode).toBe(73);
  return JSON.parse(readFileSync(join(workspace, ".aidlc/update.lock"), "utf8"));
}
function clean(root: string) {
  const resolved = resolve(root);
  const temporary = resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/");
  if (!resolved.startsWith(temporary)) throw new Error("Unsafe test cleanup");
  rmSync(resolved, { recursive: true, force: true });
}
beforeAll(() => {
  const build = Bun.spawnSync({ cmd: [process.execPath, "scripts/build.ts"], cwd: repo, stdout: "pipe", stderr: "pipe" });
  expect(build.exitCode).toBe(0);
  fixtureRoot = mkdtempSync(join(tmpdir(), "aidlc old package "));
  const unpack = spawnSync("tar", ["-xzf", join(repo, "tests/fixtures/aidlc-0.1.0.tgz"), "-C", fixtureRoot], { encoding: "utf8" });
  expect(unpack.status).toBe(0);
  oldCli = join(fixtureRoot, "package/dist/aidlc.js");
  expect(execute(oldCli, ["--version"], fixtureRoot).text.trim()).toBe("0.1.0");
});
beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "aidlc update game space "));
  write("AGENTS.md", "\ufeff# Project instructions\r\nPreserve accents: ação.\r\n");
  expect(execute(oldCli, ["init", "--governance", "standard"]).code).toBe(0);
});
afterEach(() => clean(workspace));
afterAll(() => clean(fixtureRoot));

describe("safe update from real 0.1.0 package", () => {
  test("doctor diagnoses preparation interrupted before the journal and explicit recovery unblocks update", () => {
    const before = snapshot(workspace, false);
    const abandoned = interruptPreparation();
    expect(existsSync(join(workspace, `.aidlc/backups/${abandoned.id}/journal.json`))).toBe(false);
    expect(existsSync(join(workspace, ".aidlc/pending-update.json"))).toBe(false);
    const diagnostic = cli("doctor");
    expect(diagnostic.code).toBe(1);
    expect(diagnostic.text).toContain(abandoned.id);
    expect(cli("update", "--to", "0.2.0").code).toBe(1);
    const interrupted = snapshot(workspace);
    expect(cli("rollback", abandoned.id, "--dry-run").code).toBe(0);
    expect(snapshot(workspace)).toEqual(interrupted);
    const recovered = cli("update", "--recover", abandoned.id);
    expect(recovered.code).toBe(0);
    expect(JSON.parse(recovered.text).state).toBe("preparation_aborted");
    expect(existsSync(join(workspace, ".aidlc/update.lock"))).toBe(false);
    expect(snapshot(workspace, false)).toEqual(before);
    expect(cli("doctor").code).toBe(0);
    const completed = snapshot(workspace);
    const repeat = cli("update", "--recover", abandoned.id);
    expect(repeat.code).toBe(0);
    expect(JSON.parse(repeat.text).changed).toBe(false);
    expect(snapshot(workspace)).toEqual(completed);
    expect(upgrade().state).toBe("applied");
  });
  test("a partial pre-journal snapshot is preserved for inspection while its dead lock is recoverable", () => {
    const before = snapshot(workspace, false);
    const abandoned = interruptPreparation();
    const snapshotPath = `.aidlc/backups/${abandoned.id}/snapshot.json`;
    write(snapshotPath, '{"preparation": "incomplete"}');
    expect(cli("update", "--recover", abandoned.id).code).toBe(0);
    expect(readFileSync(join(workspace, snapshotPath), "utf8")).toBe('{"preparation": "incomplete"}');
    expect(snapshot(workspace, false)).toEqual(before);
  });
  test("pre-journal recovery refuses managed drift without removing the original dead lock", () => {
    const abandoned = interruptPreparation();
    write(".aidlc/workflow.md", readFileSync(join(workspace, ".aidlc/workflow.md"), "utf8") + "\nUnrelated edit\n");
    const before = snapshot(workspace);
    const recovered = cli("update", "--recover", abandoned.id);
    expect(recovered.code).toBe(1);
    expect(recovered.text).toContain("baseline");
    expect(snapshot(workspace)).toEqual(before);
  });
  test("pre-journal recovery refuses active and unrelated transaction locks", () => {
    const abandoned = interruptPreparation();
    const before = snapshot(workspace);
    expect(cli("update", "--recover", "00000000-0000-0000-0000-000000000000").code).toBe(1);
    expect(snapshot(workspace)).toEqual(before);
    write(".aidlc/update.lock", JSON.stringify({ id: abandoned.id, pid: process.pid }));
    const active = snapshot(workspace);
    const result = cli("update", "--recover", abandoned.id);
    expect(result.code).toBe(1);
    expect(result.text).toContain("process is active");
    expect(snapshot(workspace)).toEqual(active);
  });
  test("pre-journal recovery does not erase a pending marker when its journal is missing", () => {
    const abandoned = interruptPreparation();
    write(".aidlc/pending-update.json", JSON.stringify({ id: abandoned.id }));
    const before = snapshot(workspace);
    const result = cli("update", "--recover", abandoned.id);
    expect(result.code).toBe(1);
    expect(result.text).toContain("pending");
    expect(snapshot(workspace)).toEqual(before);
  });
  test("pre-journal recovery refuses an unsupported configuration without clearing the lock", () => {
    const abandoned = interruptPreparation();
    write(".aidlc/config.yaml", readFileSync(join(workspace, ".aidlc/config.yaml"), "utf8").replace("version: 1", "version: 99"));
    const before = snapshot(workspace);
    const result = cli("update", "--recover", abandoned.id);
    expect(result.code).toBe(1);
    expect(result.text).toContain("Unsupported configuration schema");
    expect(snapshot(workspace)).toEqual(before);
  });
  test("dry-run reports versions, actions and migration with zero filesystem changes", () => {
    const before = snapshot(workspace);
    const result = cli("update", "--dry-run");
    expect(result.code).toBe(0);
    const plan = JSON.parse(result.text);
    expect(plan.from).toBe("0.1.0");
    expect(plan.to).toBe("0.2.0");
    expect(plan.migrations).toEqual(["installation manifest schema 1 -> 2; update protocol 1"]);
    expect(plan.actions.some((a: any) => a.path === "AGENTS.md" && a.action === "update")).toBe(true);
    expect(plan.actions.some((a: any) => a.path === ".aidlc/config.yaml" && a.action === "preserve")).toBe(true);
    expect(plan.changes).toBeUndefined();
    expect(snapshot(workspace)).toEqual(before);
  });
  test("update preserves configuration, state, context, decisions, observations, assets and external skills", () => {
    const paths = [".aidlc/config.yaml", ".aidlc/state.json", ".aidlc/context/resume.md", ".aidlc/observations/log.md", "docs/decisions.md", "skills/custom/SKILL.md", "Assets/scene.unity"];
    for (const path of paths.slice(2)) write(path, `User content for ${path}\r\n`);
    const existing = execute(oldCli, ["new", "Preserve this intent"]);
    expect(existing.code).toBe(0);
    const id = existing.text.match(/INTENT-[a-z0-9]+/)![0];
    paths.push(`intents/${id}.md`);
    const originals = new Map(paths.map(path => [path, readFileSync(join(workspace, path))]));
    const result = upgrade();
    expect(result.state).toBe("applied");
    const manifest = JSON.parse(readFileSync(join(workspace, ".aidlc/install.json"), "utf8"));
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.updateProtocol).toBe(1);
    expect(manifest.frameworkVersion).toBe("0.2.0");
    expect(manifest.configSchemaVersion).toBe(1);
    for (const [path, bytes] of originals) expect(readFileSync(join(workspace, path)).equals(bytes)).toBe(true);
    expect(cli("doctor").code).toBe(0);
    expect(existsSync(join(workspace, `.aidlc/backups/${result.id}/snapshot.json`))).toBe(true);
    expect(existsSync(join(workspace, ".aidlc/pending-update.json"))).toBe(false);
    const beforeSecond = snapshot(workspace);
    expect(upgrade().changed).toBe(false);
    expect(snapshot(workspace)).toEqual(beforeSecond);
  });
  test("managed drift blocks the entire update before creating backups", () => {
    const path = ".codex/agents/builder.toml";
    write(path, readFileSync(join(workspace, path), "utf8") + "\n# local rule\n");
    const before = snapshot(workspace);
    const preview = cli("update", "--dry-run");
    expect(preview.code).toBe(1);
    expect(JSON.parse(preview.text).actions).toContainEqual({ path, action: "conflict", reason: "Managed content differs from its installed baseline" });
    const result = cli("update", "--to", "0.2.0");
    expect(result.code).toBe(1);
    expect(result.text).toContain("Update conflicts");
    expect(snapshot(workspace)).toEqual(before);
  });
  test("rollback restores old managed content and metadata, preserving new user instructions and config edits", () => {
    const original = snapshot(workspace, false);
    const result = upgrade();
    const agents = readFileSync(join(workspace, "AGENTS.md"), "utf8");
    write("AGENTS.md", "# Added user prefix\n" + agents + "\nAdded user suffix\n");
    write(".aidlc/config.yaml", readFileSync(join(workspace, ".aidlc/config.yaml"), "utf8").replace("governance_profile: standard", "governance_profile: autonomous"));
    const preview = snapshot(workspace);
    expect(cli("rollback", result.id, "--dry-run").code).toBe(0);
    expect(snapshot(workspace)).toEqual(preview);
    const rolled = cli("rollback", result.id);
    expect(rolled.code).toBe(0);
    expect(JSON.parse(rolled.text).state).toBe("rolled_back");
    expect(readFileSync(join(workspace, "AGENTS.md"), "utf8")).toBe("# Added user prefix\n" + Buffer.from(original["AGENTS.md"], "base64").toString("utf8") + "\nAdded user suffix\n");
    expect(readFileSync(join(workspace, ".aidlc/config.yaml"), "utf8")).toContain("governance_profile: autonomous");
    for (const [path, bytes] of Object.entries(original)) {
      if (!["AGENTS.md", ".aidlc/config.yaml"].includes(path)) expect(readFileSync(join(workspace, path)).toString("base64")).toBe(bytes);
    }
    expect(cli("doctor").code).toBe(0);
    expect(execute(oldCli, ["doctor"]).code).toBe(0);
    const beforeRepeat = snapshot(workspace);
    expect(cli("rollback", result.id).code).toBe(0);
    expect(snapshot(workspace)).toEqual(beforeRepeat);
  });
  test("rollback refuses later edits in a changed managed file without overwriting them", () => {
    const result = upgrade();
    const path = ".aidlc/workflow.md";
    write(path, readFileSync(join(workspace, path), "utf8") + "\nMy local change\n");
    const before = snapshot(workspace);
    expect(cli("rollback", result.id).code).toBe(1);
    expect(snapshot(workspace)).toEqual(before);
  });
  test.each(["first-write", "manifest-write"])("a real process interruption at %s is recoverable", (point) => {
    const before = snapshot(workspace, false);
    const script = join(fixtureRoot, `crash-${point}.ts`);
    writeFileSync(script, `import { applyUpdate } from ${JSON.stringify(pathToFileURL(join(repo, "packages/core/update.ts")).href)};\nimport { loadResources } from ${JSON.stringify(pathToFileURL(join(repo, "packages/core/payload.ts")).href)};\napplyUpdate(process.argv[2], loadResources(process.argv[3]), "0.2.0", { afterWrite(path, count) { if (${JSON.stringify(point)} === "first-write" ? count === 1 : path === ".aidlc/install.json") process.exit(73); } });\n`);
    const crash = Bun.spawnSync({ cmd: [process.execPath, script, workspace, join(repo, "resources")], stdout: "pipe", stderr: "pipe" });
    expect(crash.exitCode).toBe(73);
    const id = JSON.parse(readFileSync(join(workspace, ".aidlc/pending-update.json"), "utf8")).id;
    expect(cli("doctor").code).toBe(1);
    const interrupted = snapshot(workspace);
    expect(cli("new", "Blocked until recovery").code).toBe(1);
    expect(cli("update", "--to", "0.2.0").code).toBe(1);
    expect(cli("init").code).toBe(1);
    expect(snapshot(workspace)).toEqual(interrupted);
    const recovered = cli("update", "--recover", id);
    expect(recovered.code).toBe(0);
    expect(JSON.parse(recovered.text).state).toBe("rolled_back");
    expect(snapshot(workspace, false)).toEqual(before);
    expect(cli("doctor").code).toBe(0);
    expect(upgrade().state).toBe("applied");
  });
  test("live update locks cannot be stolen, even with an explicit rollback", () => {
    const result = upgrade();
    write(".aidlc/update.lock", JSON.stringify({ pid: process.pid, id: result.id }));
    const before = snapshot(workspace);
    const rolled = cli("rollback", result.id);
    expect(rolled.code).toBe(1);
    expect(rolled.text).toContain("process is active");
    expect(snapshot(workspace)).toEqual(before);
  });
  test("migrate performs the bundled installation-schema upgrade and is idempotent", () => {
    expect(cli("migrate", "--dry-run").code).toBe(0);
    expect(cli("migrate", "--to", "0.2.0").code).toBe(0);
    const before = snapshot(workspace);
    expect(cli("migrate", "--to", "0.2.0").code).toBe(0);
    expect(snapshot(workspace)).toEqual(before);
  });
  test("unknown targets, network-source flags and missing explicit targets are refused without writes", () => {
    const before = snapshot(workspace);
    for (const args of [["update"], ["update", "--to", "99.0.0"], ["update", "--from", "https://example.com"], ["rollback", "../../bad"]]) {
      expect(cli(...args).code).toBe(1);
      expect(snapshot(workspace)).toEqual(before);
    }
  });
  test("malformed ownership cannot make update touch user configuration", () => {
    const manifestPath = join(workspace, ".aidlc/install.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.managed.push({ path: ".aidlc/config.yaml", kind: "file", sha256: createHash("sha256").update(readFileSync(join(workspace, ".aidlc/config.yaml"))).digest("hex") });
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const before = snapshot(workspace);
    expect(cli("update", "--to", "0.2.0").code).toBe(1);
    expect(snapshot(workspace)).toEqual(before);
  });
  test("backup tampering is rejected before restoring any content", () => {
    const result = upgrade();
    const path = `.aidlc/backups/${result.id}/snapshot.json`;
    write(path, readFileSync(join(workspace, path), "utf8") + "\n");
    const before = snapshot(workspace);
    expect(cli("rollback", result.id).text).toContain("snapshot hash");
    expect(snapshot(workspace)).toEqual(before);
  });
  test("even a rehashed backup cannot restore a user-owned path", () => {
    const result = upgrade();
    const snapshotPath = join(workspace, `.aidlc/backups/${result.id}/snapshot.json`);
    const journalPath = join(workspace, `.aidlc/backups/${result.id}/journal.json`);
    const backup = JSON.parse(readFileSync(snapshotPath, "utf8"));
    backup.changes[0].path = ".aidlc/config.yaml";
    delete backup.changes[0].kind;
    const raw = JSON.stringify(backup);
    writeFileSync(snapshotPath, raw);
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    journal.snapshotHash = createHash("sha256").update(raw).digest("hex");
    writeFileSync(journalPath, JSON.stringify(journal));
    const before = snapshot(workspace);
    const resultOfRollback = cli("rollback", result.id);
    expect(resultOfRollback.code).toBe(1);
    expect(resultOfRollback.text).toContain("Invalid backup entry");
    expect(snapshot(workspace)).toEqual(before);
  });
  test("a backup-directory junction cannot redirect backup writes outside the project", () => {
    const outside = join(fixtureRoot, "outside-backups");
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, join(workspace, ".aidlc/backups"), process.platform === "win32" ? "junction" : "dir");
    const before = snapshot(workspace);
    expect(cli("update", "--to", "0.2.0").code).toBe(1);
    expect(readdirSync(outside)).toEqual([]);
    expect(snapshot(workspace)).toEqual(before);
  });
  test("fresh 0.2.0 installation requires no migration or transaction", () => {
    const project = join(fixtureRoot, "new release");
    mkdirSync(project);
    expect(execute(current, ["init"], project).code).toBe(0);
    const before = snapshot(project);
    const result = execute(current, ["update", "--to", "0.2.0"], project);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.text).changed).toBe(false);
    expect(snapshot(project)).toEqual(before);
  });
});
