import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DEFAULT_CONFIG_YAML, loadProjectConfig } from "./config";
import { BLOCK_END, BLOCK_START, digest, FRAMEWORK_VERSION, MANIFEST_PATH, PENDING_PATH, readManifest, safePath, USER_PATHS, type Manifest } from "./installation";
import { INSTRUCTION_BLOCK, PROJECT_DOCUMENT } from "./payload";
import { inspectProject, type Diagnostic } from "./project";
import { readUtf8Instructions } from "./encoding";

export type InitOptions = { preset?: string; harness?: string; governance?: string };
export type Resources = { workflow: string; agents: Record<string, string> };
export type InitResult = Diagnostic & { created: string[]; existing: boolean };

export function initialize(root: string, resources: Resources, options: InitOptions = {}): InitResult {
  const created: string[] = [];
  let lock: number | undefined;
  const lockPath = safePath(root, ".aidlc-init.lock");
  try {
    if (existsSync(safePath(root, PENDING_PATH))) throw new Error("Interrupted update pending; recover before initialization");
    if ((options.preset ?? "default") !== "default") throw new Error(`Unsupported workflow preset: ${options.preset}; Unity Mini is planned separately`);
    if ((options.harness ?? "codex") !== "codex") throw new Error(`Unsupported harness: ${options.harness}`);
    if (options.governance && !["strict", "standard", "autonomous"].includes(options.governance)) throw new Error(`Unknown governance profile: ${options.governance}`);
    const existing = readManifest(root);
    if (existing) {
      const current = loadProjectConfig(root);
      if (options.governance && current.governanceProfile !== options.governance) throw new Error("init cannot change governance on an existing installation; edit project configuration explicitly");
      return { ...inspectProject(root), created, existing: true };
    }
    lock = openSync(lockPath, "wx");
    const block = INSTRUCTION_BLOCK;
    const files = new Map<string, { content: string; kind: "file" | "block" }>([
      [".aidlc/workflow.md", { content: resources.workflow, kind: "file" }],
      ["AGENTS.md", { content: block, kind: "block" }],
      [".aidlc/config.yaml", { content: DEFAULT_CONFIG_YAML.replace("governance_profile: strict", `governance_profile: ${options.governance ?? "strict"}`), kind: "file" }],
      [".aidlc/state.json", { content: JSON.stringify({ version: "1.0.0", initialized: true, created_at: new Date().toISOString() }, null, 2) + "\n", kind: "file" }],
    ]);
    for (const [name, content] of Object.entries(resources.agents)) {
      if (!/^[a-z][a-z0-9-]*\.toml$/.test(name)) throw new Error("Invalid packaged agent name");
      files.set(`.codex/agents/${name}`, { content, kind: "file" });
    }
    const userOwned = [...USER_PATHS];
    if (existsSync(safePath(root, "AIDLC.md"))) {
      if (!statSync(safePath(root, "AIDLC.md")).isFile()) throw new Error("Expected regular file: AIDLC.md");
      userOwned.push("AIDLC.md");
    }
    else files.set("AIDLC.md", { content: PROJECT_DOCUMENT, kind: "file" });

    // Preflight every path before the first content write. Never adopt existing managed files implicitly.
    safePath(root, MANIFEST_PATH);
    for (const dir of ["intents", "docs", ".aidlc", ".codex", ".codex/agents"]) {
      const path = safePath(root, dir);
      if (existsSync(path)) {
        if (!statSync(path).isDirectory()) throw new Error(`Expected directory: ${dir}`);
      }
    }
    for (const [path, file] of files) {
      const absolute = safePath(root, path);
      if (!existsSync(absolute)) continue;
      if (path === "AGENTS.md") {
        const content = readUtf8Instructions(absolute);
        if (content.includes(BLOCK_START) || content.includes(BLOCK_END)) throw new Error("Existing AIDLC instruction marker without installation manifest; inspect before adoption");
      } else throw new Error(`Refusing to overwrite existing file: ${path}; explicit legacy adoption or conflict resolution is required`);
    }
    for (const dir of ["intents", "docs"]) mkdirSync(safePath(root, dir), { recursive: true });
    for (const [path, file] of files) {
      const absolute = safePath(root, path);
      mkdirSync(dirname(absolute), { recursive: true });
      if (path === "AGENTS.md" && existsSync(absolute)) {
        readUtf8Instructions(absolute);
        appendFileSync(absolute, "\n\n" + file.content + "\n");
      } else writeFileSync(absolute, file.content + (file.kind === "block" ? "\n" : ""), { flag: "wx" });
      created.push(path);
    }
    const manifest: Manifest = {
      schemaVersion: 2, updateProtocol: 1, frameworkVersion: FRAMEWORK_VERSION, configSchemaVersion: 1,
      preset: "default", harness: "codex", components: { preset: FRAMEWORK_VERSION, codex: FRAMEWORK_VERSION },
      managed: [...files.entries()].filter(([path]) => !userOwned.includes(path)).map(([path, file]) => ({ path, kind: file.kind, sha256: digest(file.content) })), userOwned,
    };
    writeFileSync(safePath(root, MANIFEST_PATH), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
    created.push(MANIFEST_PATH);
    return { ...inspectProject(root), created, existing: false };
  } catch (error) {
    return { errors: [error instanceof Error ? error.message : String(error)], warnings: created.length ? ["Initialization was interrupted; inspect created files before retrying. No preexisting managed file was overwritten."] : [], created, existing: false };
  } finally {
    if (lock !== undefined) { closeSync(lock); unlinkSync(lockPath); }
  }
}
