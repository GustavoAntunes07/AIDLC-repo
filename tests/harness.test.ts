import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const node = Bun.which("node")!;
const built = join(repo, "dist/aidlc.js");
let workspace = "";

function cli(args: string[]) {
  const result = spawnSync(node, [built, ...args], { cwd: workspace, encoding: "utf8" });
  if (result.error) throw result.error;
  return { code: result.status, text: result.stdout + result.stderr };
}

function config(text: string) {
  const path = join(workspace, ".aidlc/config.yaml");
  let current = readFileSync(path, "utf8").replace(/\nrole_models:[\s\S]*$/, "");
  const harness = text.match(/^harness: (.+)$/m);
  if (harness) {
    current = current.replace(/^harness: .*$/m, `harness: ${harness[1]}`);
    text = text.replace(/^harness: .*\n?/m, "");
  }
  writeFileSync(path, current + (text.trim() ? "\n" + text : ""));
}

function install(harness: "codex" | "claude") {
  return cli(["init", "--harness", harness]);
}

function clean(path: string) {
  const resolved = resolve(path);
  const tempRoot = resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/");
  if (!resolved.startsWith(tempRoot)) throw new Error("Unsafe test cleanup");
  rmSync(resolved, { recursive: true, force: true });
}

beforeAll(() => {
  const build = Bun.spawnSync({ cmd: [process.execPath, "scripts/build.ts"], cwd: repo, stdout: "pipe", stderr: "pipe" });
  expect(build.exitCode).toBe(0);
});
beforeEach(() => { workspace = mkdtempSync(join(tmpdir(), "aidlc harness test ")); });
afterEach(() => clean(workspace));

describe("harness configuration", () => {
  test("role comments are rejected before writes and quoted hashes remain literal", () => {
    expect(install("codex").code).toBe(0);
    const path = join(workspace, ".codex/agents/planner.toml");
    const before = readFileSync(path, "utf8");
    for (const setting of ["model: gpt-6-luna # local", "reasoning: high # local", "model: 'gpt-6-luna' # use 'fast'", 'reasoning: "high" # local']) {
      config(`role_models:\n  planner:\n    ${setting}\n`);
      expect(cli(["sync"]).code).toBe(1);
      expect(cli(["doctor"]).code).toBe(1);
      expect(readFileSync(path, "utf8")).toBe(before);
    }
    for (const value of ['"model # literal"', "'model # literal'"]) {
      config(`role_models:\n  planner:\n    model: ${value}\n`);
      expect(cli(["sync"]).code).toBe(0);
      expect(readFileSync(path, "utf8")).toContain('model = "model # literal"');
    }
  });

  test("0.2.0 upgrades and rolls back while the old CLI refuses adapter installations", () => {
    const previous = join(workspace, "previous-cli");
    mkdirSync(previous);
    const archive = join(workspace, "previous.tar");
    expect(spawnSync("git", ["archive", "--format=tar", `--output=${archive}`, "f45d404"], { cwd: repo }).status).toBe(0);
    expect(spawnSync("tar", ["-xf", archive, "-C", previous]).status).toBe(0);
    const runOld = (args: string[]) => spawnSync(process.execPath, [join(previous, "scripts/aidlc.ts"), "--cwd", workspace, ...args], { encoding: "utf8" });
    expect(runOld(["init"]).status).toBe(0);
    config('role_models:\n  planner:\n    model: custom-model\n');
    const manifest = join(workspace, ".aidlc/install.json");
    const original = readFileSync(manifest, "utf8");
    const updated = cli(["update", "--to", "0.4.0"]);
    expect(updated.code).toBe(0);
    const id = JSON.parse(updated.text).id;
    const agent = join(workspace, ".codex/agents/planner.toml");
    const before = readFileSync(agent, "utf8");
    expect(before).toContain('model = "custom-model"');
    const oldUpdate = runOld(["update", "--to", "0.2.0"]);
    expect(oldUpdate.status).toBe(1);
    expect(oldUpdate.stdout + oldUpdate.stderr).toContain("Unsupported installed framework version");
    expect(readFileSync(agent, "utf8")).toBe(before);
    expect(cli(["rollback", id]).code).toBe(0);
    expect(readFileSync(manifest, "utf8")).toBe(original);
    expect(cli(["doctor"]).code).toBe(0);
    expect(cli(["update", "--to", "0.4.0"]).code).toBe(0);
  });

  test("0.3.0 CLI refuses a 0.4.0 installation before changing managed files", () => {
    const previous = join(workspace, "previous-0.3.0-cli");
    mkdirSync(previous);
    const archive = join(workspace, "previous-0.3.0.tar");
    expect(spawnSync("git", ["archive", "--format=tar", `--output=${archive}`, "a542e19"], { cwd: repo }).status).toBe(0);
    expect(spawnSync("tar", ["-xf", archive, "-C", previous]).status).toBe(0);
    const runOld = (args: string[]) => spawnSync(process.execPath, [join(previous, "scripts/aidlc.ts"), "--cwd", workspace, ...args], { encoding: "utf8" });
    expect(runOld(["init"]).status).toBe(0);

    const manifest = join(workspace, ".aidlc/install.json");
    const managed = join(workspace, ".codex/agents/planner.toml");
    const updated = cli(["update", "--to", "0.4.0"]);
    expect(updated.code).toBe(0);
    const currentManifest = readFileSync(manifest, "utf8");
    const currentManaged = readFileSync(managed, "utf8");
    expect(JSON.parse(readFileSync(manifest, "utf8")).frameworkVersion).toBe("0.4.0");

    const rejected = runOld(["update", "--to", "0.3.0"]);
    expect(rejected.status).toBe(1);
    expect(rejected.stdout + rejected.stderr).toContain("Unsupported installed framework version");
    expect(readFileSync(managed, "utf8")).toBe(currentManaged);
    expect(readFileSync(manifest, "utf8")).toBe(currentManifest);
    expect(cli(["doctor"]).code).toBe(0);
  });
  test("Claude init generates managed native agents and preserves CLAUDE.md instructions", () => {
    const prefix = "# Project instructions\nKeep these local rules.\n";
    writeFileSync(join(workspace, "CLAUDE.md"), prefix);

    expect(install("claude").code).toBe(0);
    expect(readFileSync(join(workspace, "CLAUDE.md"), "utf8")).toContain(prefix);
    expect(readFileSync(join(workspace, "CLAUDE.md"), "utf8")).toContain("aidlc:begin");
    expect(existsSync(join(workspace, "AGENTS.md"))).toBe(false);

    const planner = readFileSync(join(workspace, ".claude/agents/planner.md"), "utf8");
    expect(planner).toContain('model: "sonnet"');
    expect(planner).toContain('effort: "high"');
    expect(planner).toContain("You are the Planner agent.");
    const workflow = readFileSync(join(workspace, ".aidlc/workflow.md"), "utf8");
    expect(workflow).toContain("CLAUDE.md");
    expect(workflow).toContain("AGENTS.md");
    expect(JSON.parse(readFileSync(join(workspace, ".aidlc/install.json"), "utf8")).harness).toBe("claude");
    expect(cli(["doctor"]).code).toBe(0);
    expect(cli(["update", "--to", "0.4.0"]).code).toBe(0);
    expect(readFileSync(join(workspace, ".aidlc/workflow.md"), "utf8")).toContain("CLAUDE.md");
  });

  test("Claude role overrides render in native Markdown and sync is idempotent", () => {
    expect(install("claude").code).toBe(0);
    config('role_models:\n  planner:\n    model: "opus"\n    reasoning: "max"\n');

    const preview = cli(["sync", "--dry-run"]);
    expect(preview.code).toBe(0);
    expect(JSON.parse(preview.text).actions).toContainEqual(expect.objectContaining({ path: ".claude/agents/planner.md", action: "update" }));

    const applied = cli(["sync"]);
    expect(applied.code).toBe(0);
    expect(JSON.parse(applied.text).changed).toBe(true);
    const planner = readFileSync(join(workspace, ".claude/agents/planner.md"), "utf8");
    expect(planner).toContain('model: "opus"');
    expect(planner).toContain('effort: "max"');
    expect(cli(["sync", "--dry-run"]).text).toContain('"action": "keep"');
    expect(JSON.parse(cli(["sync"]).text).changed).toBe(false);
  });

  test("sync aborts every planned update when an agent has local edits", () => {
    expect(install("claude").code).toBe(0);
    config('role_models:\n  planner:\n    model: "opus"\n  builder:\n    model: "opus"\n');
    expect(cli(["sync"]).code).toBe(0);

    const plannerPath = join(workspace, ".claude/agents/planner.md");
    const builderPath = join(workspace, ".claude/agents/builder.md");
    const previousBuilder = readFileSync(builderPath, "utf8");
    config('role_models:\n  planner:\n    model: "sonnet"\n  builder:\n    model: "haiku"\n');
    writeFileSync(plannerPath, readFileSync(plannerPath, "utf8") + "\nlocal edit\n");

    expect(cli(["sync"]).code).toBe(1);
    expect(readFileSync(plannerPath, "utf8")).toContain("local edit");
    expect(readFileSync(builderPath, "utf8")).toBe(previousBuilder);
    const preview = cli(["sync", "--dry-run"]);
    expect(preview.code).toBe(1);
    const actions = JSON.parse(preview.text).actions;
    expect(actions).toContainEqual(expect.objectContaining({ path: ".claude/agents/planner.md", action: "conflict" }));
    expect(actions).toContainEqual(expect.objectContaining({ path: ".claude/agents/builder.md", action: "update" }));
  });

  test("rollback restores generated overrides after a successful sync", () => {
    expect(install("claude").code).toBe(0);
    config('role_models:\n  planner:\n    model: "opus"\n');
    const update = cli(["sync"]);
    expect(update.code).toBe(0);
    const transaction = JSON.parse(update.text);

    expect(cli(["rollback", transaction.id]).code).toBe(0);
    expect(readFileSync(join(workspace, ".claude/agents/planner.md"), "utf8")).toContain('model: "sonnet"');
  });

  test("Codex model overrides apply through update and sync", () => {
    expect(install("codex").code).toBe(0);
    config('role_models:\n  planner:\n    model: "gpt-custom-model"\n    reasoning: "max"\n');

    const preview = cli(["update", "--dry-run"]);
    expect(preview.code).toBe(0);
    expect(JSON.parse(preview.text).actions).toContainEqual(expect.objectContaining({ path: ".codex/agents/planner.toml", action: "update" }));

    expect(cli(["update", "--to", "0.4.0"]).code).toBe(0);
    const planner = readFileSync(join(workspace, ".codex/agents/planner.toml"), "utf8");
    expect(planner).toContain('model = "gpt-custom-model"');
    expect(planner).toContain('model_reasoning_effort = "max"');
    expect(cli(["sync"]).code).toBe(0);
  });

  test("installed harness is immutable and a missing managed agent is a conflict", () => {
    expect(install("codex").code).toBe(0);
    expect(cli(["init", "--harness", "claude"]).code).toBe(1);

    const path = join(workspace, ".codex/agents/planner.toml");
    rmSync(path);
    const preview = cli(["sync", "--dry-run"]);
    expect(preview.code).toBe(1);
    expect(JSON.parse(preview.text).actions).toContainEqual(expect.objectContaining({ path: ".codex/agents/planner.toml", action: "conflict" }));
  });

  test("doctor and sync reject config that disagrees with the installed harness", () => {
    expect(install("codex").code).toBe(0);
    config('harness: claude\n');
    const before = readFileSync(join(workspace, ".codex/agents/planner.toml"), "utf8");

    expect(cli(["doctor"]).code).toBe(1);
    const sync = cli(["sync", "--dry-run"]);
    expect(sync.code).toBe(1);
    expect(sync.text).toContain("differs from installed harness");
    expect(readFileSync(join(workspace, ".codex/agents/planner.toml"), "utf8")).toBe(before);
  });

  test("harness reports configured bindings as unverified runtime settings", () => {
    expect(install("codex").code).toBe(0);
    const result = JSON.parse(cli(["harness"]).text);
    expect(result.harness).toBe("codex");
    expect(result.bindings.find((binding: any) => binding.role === "planner")).toMatchObject({
      requested: { model: "gpt-6.2-sol", reasoning: "high" },
      runtime: "unverified",
    });
    expect(result.execution).toContain("verify the active model");
  });

  test("task overrides and specialist review produce a handoff without changing project files", () => {
    expect(install("codex").code).toBe(0);
    const agentPath = join(workspace, ".codex/agents/planner.toml");
    const manifestPath = join(workspace, ".aidlc/install.json");
    const before = [readFileSync(agentPath, "utf8"), readFileSync(manifestPath, "utf8")];

    const task = JSON.parse(cli(["harness", "--role", "planner", "--model", "task-model", "--reasoning", "medium"]).text);
    expect(task.bindings[0]).toMatchObject({ requested: { model: "task-model", reasoning: "medium" }, runtime: "unverified" });
    expect(task.bindings[0].definition).toContain('model = "task-model"');
    const specialist = JSON.parse(cli(["harness", "--specialist"]).text);
    expect(specialist.bindings[0]).toMatchObject({ role: "reviewer-specialist", requested: { model: "gpt-6.2-astra", reasoning: "high" }, runtime: "unverified" });
    expect([readFileSync(agentPath, "utf8"), readFileSync(manifestPath, "utf8")]).toEqual(before);

    expect(cli(["harness", "--role", "planner", "--reasoning", "invalid"]).code).toBe(1);
    expect([readFileSync(agentPath, "utf8"), readFileSync(manifestPath, "utf8")]).toEqual(before);
  });
});
