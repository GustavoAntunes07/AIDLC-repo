import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { configErrors, loadProjectConfig } from "./config";
import { validateProjectIntents } from "./intents";
export { field, section, validateProjectIntents } from "./intents";
import { inspectInstallation, readManifest } from "./installation";
import { agentPath, instructionPath, isHarness } from "./harness";
import { inspectObserver } from "./observer";

export type Diagnostic = { errors: string[]; warnings: string[]; observer?: ReturnType<typeof inspectObserver> };

export function discoverProject(start: string): string {
  // Commands target exactly the supplied directory; never silently install into an ancestor.
  return resolve(start);
}

export function inspectProject(root: string, options: { intents?: boolean } = {}): Diagnostic {
  const result: Diagnostic = { errors: [], warnings: [] };
  try {
    const config = existsSync(join(root, ".aidlc/config.yaml")) ? loadProjectConfig(root) : undefined;
    const harness = isHarness(config?.harness) ? config.harness : "codex";
    for (const path of [instructionPath(harness), "AIDLC.md", ".aidlc/config.yaml", ".aidlc/state.json"]) {
      const absolute = join(root, path);
      if (!existsSync(absolute)) result.errors.push(`Missing file: ${path}`);
      else if (!lstatSync(absolute).isFile()) result.errors.push(`Expected regular file: ${path}`);
    }
    for (const path of ["intents", "docs", `.${harness}/agents`]) {
      if (!existsSync(join(root, path))) result.errors.push(`Missing directory: ${path}`);
      else if (!lstatSync(join(root, path)).isDirectory()) result.errors.push(`Expected directory: ${path}`);
    }
    if (config) {
      result.errors.push(...configErrors(config));
      for (const agent of config.requiredAgents) {
        if (!/^[a-z][a-z0-9-]*$/.test(agent)) continue;
        const path = agentPath(harness, agent);
        if (!existsSync(join(root, path))) result.errors.push(`Missing required agent: ${path}`);
      }
      if (options.intents !== false) result.errors.push(...validateProjectIntents(root, config));
      result.observer = inspectObserver(root);
      result.errors.push(...result.observer.errors);
      result.warnings.push(...result.observer.warnings);
    }
    if (existsSync(join(root, ".aidlc/state.json"))) {
      const state = JSON.parse(readFileSync(join(root, ".aidlc/state.json"), "utf8"));
      if (state?.initialized !== true || state?.version !== "1.0.0") result.errors.push("Unsupported or invalid project state; migration required");
    }
    const install = inspectInstallation(root);
    result.errors.push(...install.errors);
    result.warnings.push(...install.warnings);
    if (config && !install.errors.length) {
      const manifest = readManifest(root);
      if (manifest && manifest.harness !== config.harness) result.errors.push(`Configured harness ${config.harness} differs from installed harness ${manifest.harness}; revert the harness setting`);
    }
  } catch (error) { result.errors.push(error instanceof Error ? error.message : String(error)); }
  return result;
}
