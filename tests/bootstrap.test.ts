import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspectProject } from "../packages/core/project";
import { DEFAULT_CONFIG_YAML } from "../packages/core/config";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const node = Bun.which("node")!;
const built = join(repo, "dist/aidlc.js");
let workspace: string;
function cli(args: string[], entry = built, cwd = workspace) {
  const result = spawnSync(node, [entry, ...args], { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  return { code: result.status, text: result.stdout + result.stderr };
}
function snapshot(root: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const child of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, child.name);
    if (child.isDirectory()) for (const [key, value] of Object.entries(snapshot(path))) entries[child.name + "/" + key] = value;
    else entries[child.name] = readFileSync(path).toString("base64");
  }
  return entries;
}
function edit(path: string, from: string, to: string) {
  const absolute = join(workspace, path);
  writeFileSync(absolute, readFileSync(absolute, "utf8").replace(from, to));
}
beforeAll(() => {
  const build = Bun.spawnSync({ cmd: [process.execPath, "scripts/build.ts"], cwd: repo, stdout: "pipe", stderr: "pipe" });
  expect(build.exitCode).toBe(0);
});
beforeEach(() => { workspace = mkdtempSync(join(tmpdir(), "aidlc bootstrap space ")); });
afterEach(() => {
  // workspace is an absolute, unique temporary child; never remove an input project.
  if (workspace && resolve(workspace).startsWith(resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/"))) rmSync(workspace, { recursive: true, force: true });
});

describe("installable bootstrap", () => {
  test("unsupported instruction encodings fail preflight without changing any bytes", () => {
    const text = "# Instruções\r\nNão remover estas regras.\r\n";
    const le = Buffer.from(text, "utf16le");
    const be = Buffer.from(le).swap16();
    const variants = [
      Buffer.concat([Buffer.from([0xff, 0xfe]), le]),
      Buffer.concat([Buffer.from([0xfe, 0xff]), be]),
      le,
      Buffer.from([0x23, 0x20, 0x49, 0x6e, 0x73, 0x74, 0x72, 0x75, 0xe7, 0xf5, 0x65, 0x73]),
    ];
    for (const bytes of variants) {
      writeFileSync(join(workspace, "AGENTS.md"), bytes);
      const before = snapshot(workspace);
      const result = cli(["init"]);
      expect(result.code).toBe(1);
      expect(result.text).toContain("Unsupported text encoding in AGENTS.md");
      expect(snapshot(workspace)).toEqual(before);
      expect(readFileSync(join(workspace, "AGENTS.md")).equals(bytes)).toBe(true);
      expect(readdirSync(workspace)).toEqual(["AGENTS.md"]);
    }
  });
  test("UTF-8 BOM, accents and line endings remain byte-identical before the appended block", () => {
    const bytes = Buffer.from("\ufeff# Instruções\r\nNão remover 🧪.\r\n", "utf8");
    writeFileSync(join(workspace, "AGENTS.md"), bytes);
    expect(cli(["init"]).code).toBe(0);
    const result = readFileSync(join(workspace, "AGENTS.md"));
    expect(result.subarray(0, bytes.length).equals(bytes)).toBe(true);
    expect(cli(["doctor"]).code).toBe(0);
    const before = snapshot(workspace);
    expect(cli(["init"]).code).toBe(0);
    expect(snapshot(workspace)).toEqual(before);
  });
  test.each([
    "config-schema", "manifest-schema", "framework-version", "component-version", "state-version",
  ])("legacy commands refuse incompatible %s before any writes", (variant) => {
    expect(cli(["init"]).code).toBe(0);
    const created = cli(["new", "Existing intent"]);
    expect(created.code).toBe(0);
    const id = created.text.match(/INTENT-[a-z0-9]+/)![0];
    edit(`intents/${id}.md`, "status: backlog", "status: ready_for_testing");
    if (variant === "config-schema") edit(".aidlc/config.yaml", "version: 1", "version: 99");
    else if (variant === "state-version") edit(".aidlc/state.json", '"version": "1.0.0"', '"version": "99.0.0"');
    else {
      const path = join(workspace, ".aidlc/install.json");
      const manifest = JSON.parse(readFileSync(path, "utf8"));
      if (variant === "manifest-schema") manifest.schemaVersion = 99;
      if (variant === "framework-version") manifest.frameworkVersion = "99.0.0";
      if (variant === "component-version") manifest.components.codex = "99.0.0";
      writeFileSync(path, JSON.stringify(manifest));
    }
    // setup and read-oriented legacy commands used to create missing directories.
    const intentsPath = resolve(workspace, "intents");
    expect(dirname(intentsPath)).toBe(resolve(workspace));
    rmSync(intentsPath, { recursive: true });
    const before = snapshot(workspace);
    for (const args of [["setup"], ["new", "Must not write"], ["transition", id, "review"], ["close", id, "Must not close"], ["status"], ["list"], ["next"], ["validate"]]) {
      const result = cli(args);
      expect(result.code).toBe(1);
      expect(result.text).toMatch(/Unsupported|incompatible/);
      expect(snapshot(workspace)).toEqual(before);
      expect(existsSync(intentsPath)).toBe(false);
    }
  });
  test("new, transition and close do not modify an existing intent under an unknown schema", () => {
    expect(cli(["init"]).code).toBe(0);
    const created = cli(["new", "Existing intent"]);
    const id = created.text.match(/INTENT-[a-z0-9]+/)![0];
    edit(`intents/${id}.md`, "status: backlog", "status: ready_for_testing");
    edit(".aidlc/config.yaml", "version: 1", "version: 99");
    const before = snapshot(workspace);
    for (const args of [["new", "Forbidden"], ["transition", id, "review"], ["close", id]]) {
      expect(cli(args).code).toBe(1);
      expect(snapshot(workspace)).toEqual(before);
    }
  });
  test("recognized legacy projects without a manifest retain writable lifecycle commands", () => {
    expect(cli(["init"]).code).toBe(0);
    unlinkSync(join(workspace, ".aidlc/install.json"));
    const created = cli(["new", "Supported legacy intent"]);
    expect(created.code).toBe(0);
    const id = created.text.match(/INTENT-[a-z0-9]+/)![0];
    edit(`intents/${id}.md`, "status: backlog", "status: ready_for_testing");
    expect(cli(["transition", id, "review"]).code).toBe(0);
    expect(cli(["close", id, "Completed compatibility check"]).code).toBe(0);
    expect(readFileSync(join(workspace, `intents/${id}.md`), "utf8")).toContain("status: closed");
    expect(cli(["doctor"]).code).toBe(0);
    expect(existsSync(join(workspace, ".aidlc/install.json"))).toBe(false);
  });
  test("new refuses an unconfigured project without creating an intents directory", () => {
    expect(cli(["new", "Requires setup"]).code).toBe(1);
    expect(readdirSync(workspace)).toEqual([]);
  });
  test("initializes an existing project, preserves instructions and game content, and reruns without writes", () => {
    mkdirSync(join(workspace, "Assets"));
    writeFileSync(join(workspace, "Assets/scene.unity"), "unchanged");
    writeFileSync(join(workspace, "AGENTS.md"), "# My project\r\nKeep this byte sequence.\r\n");
    writeFileSync(join(workspace, "AIDLC.md"), "My existing project process\n");
    const original = readFileSync(join(workspace, "AGENTS.md"), "utf8");
    expect(cli(["init", "--governance", "standard"]).code).toBe(0);
    expect(readFileSync(join(workspace, "AGENTS.md"), "utf8").startsWith(original)).toBe(true);
    expect(readFileSync(join(workspace, "AIDLC.md"), "utf8")).toBe("My existing project process\n");
    expect(readFileSync(join(workspace, "Assets/scene.unity"), "utf8")).toBe("unchanged");
    const before = snapshot(workspace);
    expect(cli(["init"]).code).toBe(0);
    expect(snapshot(workspace)).toEqual(before);
    expect(cli(["doctor"]).code).toBe(0);
    expect(snapshot(workspace)).toEqual(before);
    const config = JSON.parse(cli(["config"]).text);
    expect(config.governanceProfile).toBe("standard");
    expect(config.schemaVersion).toBe(1);
    expect(config.workflowPreset).toBe("default");
    expect(config.harness).toBe("codex");
  });
  test("fresh installation works with explicit cwd and generates a versioned manifest", () => {
    expect(cli(["--cwd", workspace, "init"], built, repo).code).toBe(0);
    const manifest = JSON.parse(readFileSync(join(workspace, ".aidlc/install.json"), "utf8"));
    expect(manifest.frameworkVersion).toBe("0.3.0");
    expect(manifest.configSchemaVersion).toBe(1);
    expect(manifest.managed.find((f: any) => f.path === "AGENTS.md").kind).toBe("block");
    expect(manifest.userOwned).toContain(".aidlc/observations/");
    expect(cli(["doctor"]).code).toBe(0);
  });
  test("existing managed conflict is detected before content writes", () => {
    mkdirSync(join(workspace, ".codex/agents"), { recursive: true });
    writeFileSync(join(workspace, ".codex/agents/builder.toml"), "custom builder");
    const before = snapshot(workspace);
    const result = cli(["init"]);
    expect(result.code).toBe(1);
    expect(result.text).toContain("Refusing to overwrite");
    expect(snapshot(workspace)).toEqual(before);
  });
  test("unknown presets, harnesses, options and governance do not create files", () => {
    for (const args of [["--preset", "unity-mini"], ["--harness", "unknown-harness"], ["--governance", "surprise"], ["--overwrite", "true"]]) {
      expect(cli(["init", ...args]).code).toBe(1);
      expect(readdirSync(workspace)).toEqual([]);
    }
    expect(cli(["update"]).code).toBe(1);
  });
  test("an existing directory at the document path fails preflight", () => {
    mkdirSync(join(workspace, "AIDLC.md"));
    expect(cli(["init"]).text).toContain("Expected regular file: AIDLC.md");
    expect(readdirSync(workspace)).toEqual(["AIDLC.md"]);
  });
  test("doctor reports managed drift but allows user edits outside its instruction block", () => {
    expect(cli(["init"]).code).toBe(0);
    writeFileSync(join(workspace, "AGENTS.md"), "# User rules\n" + readFileSync(join(workspace, "AGENTS.md"), "utf8"));
    expect(cli(["doctor"]).code).toBe(0);
    edit(".codex/agents/builder.toml", "gpt-6.2-sol", "custom-model");
    const before = snapshot(workspace);
    const result = cli(["doctor"]);
    expect(result.code).toBe(1);
    expect(result.text).toContain("Modified managed content");
    expect(snapshot(workspace)).toEqual(before);
    expect(cli(["init"]).code).toBe(1);
    expect(snapshot(workspace)).toEqual(before);
  });
  test("doctor refuses unknown schemas and manifest versions without changing state", () => {
    expect(cli(["init"]).code).toBe(0);
    edit(".aidlc/config.yaml", "version: 1", "version: 99");
    const before = snapshot(workspace);
    expect(cli(["doctor"]).text).toContain("Unsupported configuration schema");
    expect(snapshot(workspace)).toEqual(before);
    edit(".aidlc/config.yaml", "version: 99", "version: 1");
    const manifestPath = join(workspace, ".aidlc/install.json");
    const unsupported = JSON.parse(readFileSync(manifestPath, "utf8"));
    unsupported.schemaVersion = 99;
    writeFileSync(manifestPath, JSON.stringify(unsupported));
    expect(cli(["doctor"]).text).toContain("Unsupported installation manifest schema");
  });
  test("doctor is read-only when an intent directory is missing", () => {
    expect(cli(["init"]).code).toBe(0);
    rmSync(join(workspace, "intents"), { recursive: true });
    const before = snapshot(workspace);
    expect(cli(["doctor"]).code).toBe(1);
    expect(existsSync(join(workspace, "intents"))).toBe(false);
    expect(snapshot(workspace)).toEqual(before);
  });
  test("invalid branch enforcement and duplicate governance are rejected", () => {
    expect(cli(["init"]).code).toBe(0);
    const path = join(workspace, ".aidlc/config.yaml");
    const original = readFileSync(path, "utf8");
    writeFileSync(path, original.replace("enforce_intent_branch: true", "enforce_intent_branch: maybe"));
    expect(cli(["doctor"]).text).toContain("must be true or false");
    writeFileSync(path, original + "\ngovernance_profile: autonomous\n");
    expect(cli(["doctor"]).text).toContain("Duplicate configuration key");
  });
  test("legacy projects receive diagnostics without implicit adoption", () => {
    mkdirSync(join(workspace, ".aidlc"));
    writeFileSync(join(workspace, ".aidlc/config.yaml"), DEFAULT_CONFIG_YAML);
    const before = snapshot(workspace);
    expect(cli(["init"]).text).toContain("Refusing to overwrite existing file");
    expect(inspectProject(workspace).warnings.join()).toContain("Legacy project");
    expect(snapshot(workspace)).toEqual(before);
  });
  test("a manifest cannot direct doctor outside the project", () => {
    expect(cli(["init"]).code).toBe(0);
    const path = join(workspace, ".aidlc/install.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    manifest.managed[0].path = "../outside.md";
    writeFileSync(path, JSON.stringify(manifest));
    expect(cli(["doctor"]).text).toContain("Unsafe managed path");
  });
  test("init refuses a directory junction instead of writing outside the project", () => {
    const target = join(workspace, "outside");
    mkdirSync(target);
    const project = join(workspace, "project");
    mkdirSync(project);
    symlinkSync(target, join(project, ".aidlc"), process.platform === "win32" ? "junction" : "dir");
    expect(cli(["init"], built, project).code).toBe(1);
    expect(readdirSync(target)).toEqual([]);
  });
  test("generated model assignments match the accepted baseline", () => {
    expect(cli(["init"]).code).toBe(0);
    const agent = (name: string) => readFileSync(join(workspace, ".codex/agents", name + ".toml"), "utf8");
    expect(agent("planner")).toContain('model = "gpt-6.2-sol"');
    expect(agent("tester")).toContain('model = "gpt-6.2-sol"');
    expect(agent("reviewer")).toContain('model = "gpt-6.2-sol"');
    expect(agent("reader")).toContain('model_reasoning_effort = "high"');
    expect(readFileSync(join(workspace, ".aidlc/workflow.md"), "utf8")).toContain("Astra 6.2");
  });
  test("the npm tarball installs and runs outside the framework checkout", () => {
    const npmPath = Bun.which(process.platform === "win32" ? "npm.cmd" : "npm")!;
    const npmCli = process.platform === "win32"
      ? join(dirname(npmPath), "node_modules/npm/bin/npm-cli.js")
      : realpathSync(npmPath);
    const npm = (args: string[], cwd: string) => spawnSync(node, [npmCli, ...args], { cwd, encoding: "utf8", env: { ...process.env, npm_config_cache: join(workspace, "cache") } });
    const packed = npm(["pack", "--ignore-scripts", "--json", "--pack-destination", workspace], repo);
    expect(packed.status).toBe(0);
    const info = JSON.parse(packed.stdout)[0];
    expect(info.files.some((f: any) => f.path === "dist/aidlc.js")).toBe(true);
    expect(info.files.some((f: any) => f.path.startsWith("intents/"))).toBe(false);
    const install = join(workspace, "consumer");
    mkdirSync(install);
    const result = npm(["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", join(workspace, info.filename)], install);
    expect(result.status).toBe(0);
    const project = join(workspace, "game project");
    mkdirSync(project);
    const entry = join(install, "node_modules/aidlc/dist/aidlc.js");
    expect(cli(["--version"], entry, project).text.trim()).toBe("0.3.0");
    expect(cli(["init"], entry, project).code).toBe(0);
    expect(cli(["doctor"], entry, project).code).toBe(0);
    expect(cli(["intent", "new", "Packaged lifecycle"], entry, project).code).toBe(0);
    const fullIntent = readdirSync(join(project, "intents"))[0];
    expect(JSON.parse(cli(["intent", "show", fullIntent], entry, project).text).schema).toBe("full-v1");
    expect(cli(["intent", "list"], entry, project)).toEqual(cli(["list"], entry, project));
    // Config and intents remain user-owned; compact Core use does not convert full history.
    const preserved = readFileSync(join(project, "intents", fullIntent), "utf8");
    writeFileSync(join(project, ".aidlc/config.yaml"), "version: 1\nworkflow_preset: compact\ngovernance_profile: standard\n");
    expect(cli(["intent", "new", "Packaged compact bug", "--type", "bug"], entry, project).code).toBe(0);
    const compactIntent = readdirSync(join(project, "intents")).find(file => file !== fullIntent)!;
    const compactRecord = JSON.parse(cli(["intent", "show", compactIntent], entry, project).text);
    expect(compactRecord.schema).toBe("compact-v1");
    expect(compactRecord.content).toContain("type: bug");
    expect(readFileSync(join(project, "intents", fullIntent), "utf8")).toBe(preserved);
    expect(cli(["doctor"], entry, project).code).toBe(0);
    expect(existsSync(join(install, "node_modules/.bin", process.platform === "win32" ? "aidlc.cmd" : "aidlc"))).toBe(true);
    const shim = npm(["exec", "--offline", "--", "aidlc", "--version"], install);
    expect(shim.status).toBe(0);
    expect(shim.stdout.trim()).toBe("0.3.0");
    const previous = join(workspace, "previous package");
    mkdirSync(previous);
    expect(spawnSync("tar", ["-xzf", join(repo, "tests/fixtures/aidlc-0.1.0.tgz"), "-C", previous]).status).toBe(0);
    const upgradeProject = join(workspace, "previous project");
    mkdirSync(upgradeProject);
    expect(cli(["init"], join(previous, "package/dist/aidlc.js"), upgradeProject).code).toBe(0);
    expect(cli(["update", "--dry-run"], entry, upgradeProject).code).toBe(0);
    const upgraded = cli(["update", "--to", "0.3.0"], entry, upgradeProject);
    expect(upgraded.code).toBe(0);
    const transaction = JSON.parse(upgraded.text);
    expect(cli(["doctor"], entry, upgradeProject).code).toBe(0);
    expect(cli(["rollback", transaction.id], entry, upgradeProject).code).toBe(0);
    expect(JSON.parse(readFileSync(join(upgradeProject, ".aidlc/install.json"), "utf8")).frameworkVersion).toBe("0.1.0");
  }, 30000);
});
