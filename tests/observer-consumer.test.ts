import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = join(repo, "dist/aidlc.js");
const node = Bun.which("node")!;
let root: string;
function cli(...args: string[]) {
  const result = spawnSync(node, [built, ...args], { cwd: root, encoding: "utf8", timeout: 15_000 });
  if (result.error) throw result.error;
  return { code: result.status, text: result.stdout + result.stderr };
}
function ok(...args: string[]): any {
  const result = cli(...args);
  if (result.code !== 0) throw new Error(result.text);
  return JSON.parse(result.text);
}
function write(path: string, text: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}
function configure(harness: string, preset: string) {
  expect(cli("init", "--harness", harness, "--governance", "standard").code).toBe(0);
  write(".aidlc/config.yaml", `version: 1\nworkflow_preset: ${preset}\nharness: ${harness}\ngovernance_profile: standard\nobserver:\n  enabled: true\nbranches:\n  enforce_intent_branch: false\n`);
  const compact = preset === "compact";
  write("intents/INTENT-consumer.md", `---\nid: INTENT-consumer\ntitle: Reviewed skill improvement\nstatus: review\n${compact ? "schema: compact-v1\ntype: feature" : "story_points: 1\nretry_count: 0"}\nbranch: intent/consumer\n---\n\n# ${compact ? "Objective" : "Description"}\nImprove a project skill.\n\n# Scope\nProject skill only.\n\n# Acceptance Criteria\n- [x] Candidate is reviewed.\n\n# Plan\nReview the staged candidate.\n\n# Related Files\nskills/local/SKILL.md\n\n# ${compact ? "Validation" : "Test Notes"}\nCandidate validated.\n\n# ${compact ? "Review" : "Review Notes"}\nAPPROVED by an independent reviewer.\n`);
}
function proposal(preset = "default") {
  ok("observer", "session", "--session", "capture-session", "--intent", "INTENT-consumer");
  write("capture.json", JSON.stringify({ schemaVersion: 1, session: "capture-session", intent: "INTENT-consumer", occurrence: "one", category: "skill-gap", evidence: "A reusable local check was missing.", skill: "local", suggestion: "Document the check.", sanitized: true }));
  const observation = ok("observer", "capture", "--file", "capture.json");
  write("skills/local/SKILL.md", "# Local skill\nOriginal instructions.\n");
  write("proposal.json", JSON.stringify({ schemaVersion: 1, intent: "INTENT-consumer", observations: [observation.id], target: "skills/local/SKILL.md", kind: "project", candidate: "# Local skill\nOriginal instructions.\nA reusable check.\n" }));
  const staged = ok("observer", "proposal", "stage", "--file", "proposal.json");
  ok("observer", "proposal", "review", staged.id, "--decision", "approved", "--reviewer", "review-session", "--hash", staged.hash, "--note", "Reviewed separately.");
  if (preset === "default") expect(cli("intent", "transition", "INTENT-consumer", "approved").code).toBe(0);
  return { staged, observation };
}
beforeAll(() => {
  const build = Bun.spawnSync({ cmd: [process.execPath, "scripts/build.ts"], cwd: repo, stdout: "pipe", stderr: "pipe" });
  expect(build.exitCode).toBe(0);
});
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "aidlc observer consumer ")); });
afterEach(() => {
  const absolute = resolve(root), temporaryRoot = resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/");
  if (!absolute.startsWith(temporaryRoot)) throw new Error("Unsafe observer consumer cleanup");
  rmSync(absolute, { recursive: true, force: true });
});

describe("observer across supported consumers", () => {
  for (const harness of ["codex", "claude"]) for (const preset of ["default", "compact"]) {
    test(`${harness}/${preset} applies a reviewed local proposal and retains honest activation evidence`, () => {
      configure(harness, preset);
      const { staged, observation } = proposal(preset);
      expect(ok("observer", "proposal", "apply", staged.id, "--authorize", staged.hash)).toMatchObject({ state: "applied", changed: true });
      expect(readFileSync(join(root, "skills/local/SKILL.md"), "utf8")).toBe(staged.payload.candidate);
      expect(ok("observer", "show", observation.id).proposals).toContainEqual({ id: staged.id, reviewStatus: "applied" });
      expect(ok("observer", "status")).toMatchObject({ enabled: true, mode: "session-guided", automaticHooks: "unavailable" });
      expect(cli("doctor").code).toBe(0);
    });
  }

  for (const point of ["afterPrepared", "afterSkillWrite"]) {
    test(`a process exit at ${point} preserves recoverable state and restores the original skill`, () => {
      configure("codex", "default");
      const { staged } = proposal();
      const original = readFileSync(join(root, "skills/local/SKILL.md"), "utf8");
      const script = join(root, "crash.ts");
      writeFileSync(script, `import { runObserver } from ${JSON.stringify(pathToFileURL(join(repo, "packages/core/observer.ts")).href)};\nrunObserver(process.argv[2], ["proposal", "apply", process.argv[3], "--authorize", process.argv[4]], { ${point}() { process.exit(73); } });\n`);
      const crashed = spawnSync(process.execPath, [script, root, staged.id, staged.hash], { cwd: repo, encoding: "utf8", timeout: 15_000 });
      expect(crashed.status).toBe(73);
      expect(existsSync(join(root, ".aidlc/observations/operation.lock"))).toBe(true);
      expect(cli("doctor").code).toBe(1);
      // Recovery is available even when capture is subsequently disabled.
      const configPath = join(root, ".aidlc/config.yaml");
      writeFileSync(configPath, readFileSync(configPath, "utf8").replace("enabled: true", "enabled: false"));
      expect(ok("observer", "proposal", "recover", staged.id, "--authorize", staged.hash).state).toBe("rolled_back");
      expect(readFileSync(join(root, "skills/local/SKILL.md"), "utf8")).toBe(original);
      expect(existsSync(join(root, ".aidlc/observations/operation.lock"))).toBe(false);
      expect(ok("observer", "proposal", "recover", staged.id, "--authorize", staged.hash)).toMatchObject({ state: "rolled_back", changed: false });
      expect(cli("doctor").code).toBe(0);
    });
  }

  test("recovery clears an abandoned completed-operation lock without undoing the applied skill", () => {
    configure("codex", "default");
    const { staged } = proposal();
    ok("observer", "proposal", "apply", staged.id, "--authorize", staged.hash);
    write(".aidlc/observations/operation.lock", JSON.stringify({ schemaVersion: 1, token: "12345678-1234-1234-1234-123456789abc", proposal: staged.id, pid: 2147483647, project: realpathSync(root) }));
    expect(ok("observer", "proposal", "recover", staged.id, "--authorize", staged.hash)).toMatchObject({ state: "applied", changed: false });
    expect(readFileSync(join(root, "skills/local/SKILL.md"), "utf8")).toBe(staged.payload.candidate);
    expect(existsSync(join(root, ".aidlc/observations/operation.lock"))).toBe(false);
  });

  test("oversized UTF-8 candidates are rejected before staging or writing a live skill", () => {
    configure("codex", "default");
    const { observation } = proposal();
    const candidate = "# Skill\n" + "é".repeat(60_000);
    expect(candidate.length).toBeLessThan(100_000);
    expect(Buffer.byteLength(candidate, "utf8")).toBeGreaterThan(100_000);
    const before = ok("observer", "list");
    write("large-proposal.json", JSON.stringify({ schemaVersion: 1, intent: "INTENT-consumer", observations: [observation.id], target: "skills/large/SKILL.md", kind: "project", candidate }));
    expect(cli("observer", "proposal", "stage", "--file", "large-proposal.json").code).toBe(1);
    expect(ok("observer", "list")).toEqual(before);
    expect(existsSync(join(root, "skills/large/SKILL.md"))).toBe(false);
  });

  test("a multibyte candidate at the byte limit remains recoverable after a process exit", () => {
    configure("codex", "default");
    const { observation } = proposal();
    const candidate = "# Skill\n" + "é".repeat(49_996);
    expect(Buffer.byteLength(candidate, "utf8")).toBe(100_000);
    write("boundary-proposal.json", JSON.stringify({ schemaVersion: 1, intent: "INTENT-consumer", observations: [observation.id], target: "skills/local/SKILL.md", kind: "project", candidate }));
    const staged = ok("observer", "proposal", "stage", "--file", "boundary-proposal.json");
    ok("observer", "proposal", "review", staged.id, "--decision", "approved", "--reviewer", "boundary-review", "--hash", staged.hash, "--note", "Reviewed multibyte boundary.");
    const original = readFileSync(join(root, "skills/local/SKILL.md"), "utf8");
    const script = join(root, "boundary-crash.ts");
    writeFileSync(script, `import { runObserver } from ${JSON.stringify(pathToFileURL(join(repo, "packages/core/observer.ts")).href)};\nrunObserver(process.argv[2], ["proposal", "apply", process.argv[3], "--authorize", process.argv[4]], { afterSkillWrite() { process.exit(73); } });\n`);
    expect(spawnSync(process.execPath, [script, root, staged.id, staged.hash], { cwd: repo, encoding: "utf8", timeout: 15_000 }).status).toBe(73);
    expect(ok("observer", "proposal", "recover", staged.id, "--authorize", staged.hash).state).toBe("rolled_back");
    expect(readFileSync(join(root, "skills/local/SKILL.md"), "utf8")).toBe(original);
  });

  test("an expanded proposal envelope is rejected before publishing an unreadable record", () => {
    configure("codex", "default");
    const { observation } = proposal();
    const baseline = "# Original\n" + "\u0001".repeat(99_980);
    expect(Buffer.byteLength(baseline, "utf8")).toBeLessThan(100_000);
    // Existing UTF-8 file contents can expand sixfold when JSON-escaped.
    // The baseline appears both as a snapshot and as removed diff lines.
    expect(Buffer.byteLength(JSON.stringify({ base: baseline, removed: baseline }), "utf8")).toBeGreaterThan(1024 * 1024);
    write("skills/expanded/SKILL.md", baseline);
    const before = ok("observer", "list");
    write("expanded-proposal.json", JSON.stringify({ schemaVersion: 1, intent: "INTENT-consumer", observations: [observation.id], target: "skills/expanded/SKILL.md", kind: "project", candidate: "# Candidate\n" + "\n".repeat(99_980) }));
    expect(cli("observer", "proposal", "stage", "--file", "expanded-proposal.json").code).toBe(1);
    expect(ok("observer", "list")).toEqual(before);
  });
});
