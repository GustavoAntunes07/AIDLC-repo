import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { configErrors, isIntentStatus, loadProjectConfig, type AidlcConfig } from "./config";
import { inspectInstallation } from "./installation";

export type Diagnostic = { errors: string[]; warnings: string[] };
export const field = (text: string, key: string) => text.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1]?.trim();
export function section(text: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`(?:^|\\r?\\n)# ${escaped}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n# |$)`))?.[1]?.trim() ?? "";
}

export function validateProjectIntents(root: string, config?: AidlcConfig): string[] {
  const errors: string[] = [];
  try {
    config ??= loadProjectConfig(root);
    const dir = join(root, "intents");
    if (!existsSync(dir)) return ["Missing directory: intents"];
    for (const file of readdirSync(dir).filter(f => f.endsWith(".md"))) {
      const text = readFileSync(join(dir, file), "utf8");
      for (const key of ["id", "title", "status", "story_points", "retry_count", "branch"]) {
        if (!field(text, key)) errors.push(`${file} is missing field: ${key}`);
      }
      const status = field(text, "status");
      if (status && !isIntentStatus(status)) errors.push(`${file} has invalid status: ${status}`);
      const branch = field(text, "branch");
      if (branch && branch !== "null" && !branch.startsWith(config.intentBranchPrefix)) errors.push(`${file} branch must start with ${config.intentBranchPrefix}`);
      if (!section(text, "Description")) errors.push(`${file} is missing a Description section body`);
      if (!/- \[[ xX]\] .+/.test(section(text, "Acceptance Criteria"))) errors.push(`${file} must define at least one acceptance criterion`);
    }
  } catch (error) { errors.push(String(error instanceof Error ? error.message : error)); }
  return errors;
}

export function discoverProject(start: string): string {
  // Commands target exactly the supplied directory; never silently install into an ancestor.
  return resolve(start);
}

export function inspectProject(root: string, options: { intents?: boolean } = {}): Diagnostic {
  const result: Diagnostic = { errors: [], warnings: [] };
  try {
    for (const path of ["AGENTS.md", "AIDLC.md", ".aidlc/config.yaml", ".aidlc/state.json"]) {
      const absolute = join(root, path);
      if (!existsSync(absolute)) result.errors.push(`Missing file: ${path}`);
      else if (!lstatSync(absolute).isFile()) result.errors.push(`Expected regular file: ${path}`);
    }
    for (const path of ["intents", "docs", ".codex/agents"]) {
      if (!existsSync(join(root, path))) result.errors.push(`Missing directory: ${path}`);
      else if (!lstatSync(join(root, path)).isDirectory()) result.errors.push(`Expected directory: ${path}`);
    }
    if (existsSync(join(root, ".aidlc/config.yaml"))) {
      const config = loadProjectConfig(root);
      result.errors.push(...configErrors(config));
      for (const agent of config.requiredAgents) {
        if (!/^[a-z][a-z0-9-]*$/.test(agent)) continue;
        if (!existsSync(join(root, ".codex/agents", agent + ".toml"))) result.errors.push(`Missing required agent: .codex/agents/${agent}.toml`);
      }
      if (options.intents !== false) result.errors.push(...validateProjectIntents(root, config));
    }
    if (existsSync(join(root, ".aidlc/state.json"))) {
      const state = JSON.parse(readFileSync(join(root, ".aidlc/state.json"), "utf8"));
      if (state?.initialized !== true || state?.version !== "1.0.0") result.errors.push("Unsupported or invalid project state; migration required");
    }
    const install = inspectInstallation(root);
    result.errors.push(...install.errors);
    result.warnings.push(...install.warnings);
  } catch (error) { result.errors.push(error instanceof Error ? error.message : String(error)); }
  return result;
}
