import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { configErrors, loadProjectConfig } from "./config";
import { validateProjectIntents } from "./intents";
export { field, section, validateProjectIntents } from "./intents";
import { inspectInstallation } from "./installation";

export type Diagnostic = { errors: string[]; warnings: string[] };

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
