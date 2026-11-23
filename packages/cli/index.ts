import { resolve } from "node:path";
import { configErrors, loadProjectConfig } from "../core/config";
import { compatibilityErrors } from "../core/compatibility";
import { initialize } from "../core/init";
import { FRAMEWORK_VERSION } from "../core/installation";
import { discoverProject, inspectProject } from "../core/project";
import { runLegacy } from "./legacy";
import { loadResources } from "../core/payload";
import { applyUpdate, planUpdate } from "../core/update";
import { rollback } from "../core/transactions";

const HELP = `AIDLC ${FRAMEWORK_VERSION}
Usage: aidlc [--cwd <project>] <command>

  init [--preset default] [--harness codex] [--governance strict|standard|autonomous]
  config
  doctor
  update --dry-run [--to ${FRAMEWORK_VERSION}]
  update --to ${FRAMEWORK_VERSION}
  update --recover <transaction-id>
  migrate --to ${FRAMEWORK_VERSION} [--dry-run]
  rollback <transaction-id> [--dry-run]
  --version

Compatible commands: setup, check-setup, new, status, list, next, validate,
branch <intent>, transition <intent> <status>, close <intent> [reason].

Updates use only this package's bundled target. No network or publication is performed.
Unity Mini, Task Observer, legacy-template adoption and sync are not available yet.
`;

export function runCli(input: string[], resourcesDir?: string): number {
  const originalCwd = process.cwd();
  try {
    const argv = [...input];
    let root = originalCwd;
    const cwdIndex = argv.indexOf("--cwd");
    if (cwdIndex >= 0) {
      if (!argv[cwdIndex + 1] || argv[cwdIndex + 1].startsWith("--")) throw new Error("--cwd requires a project directory");
      root = resolve(originalCwd, argv[cwdIndex + 1]);
      argv.splice(cwdIndex, 2);
    }
    root = discoverProject(root);
    const [command, ...args] = argv;
    if (!command || ["help", "--help", "-h"].includes(command)) { console.log(HELP); return 0; }
    if (command === "--version") { console.log(FRAMEWORK_VERSION); return 0; }
    if (["update", "migrate"].includes(command)) {
      let target: string | undefined, recovery: string | undefined;
      let dryRun = false;
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--dry-run" && !dryRun) dryRun = true;
        else if (arg === "--to" && !target && args[i + 1] && !args[i + 1].startsWith("--")) target = args[++i];
        else if (arg === "--recover" && !recovery && args[i + 1] && !args[i + 1].startsWith("--")) recovery = args[++i];
        else throw new Error(`Invalid ${command} option: ${arg}`);
      }
      if (recovery) {
        if (command !== "update" || target || dryRun) throw new Error("Recovery accepts only update --recover <transaction-id>");
        console.log(JSON.stringify(rollback(root, recovery), null, 2)); return 0;
      }
      if (!dryRun && !target) throw new Error(`Use --dry-run or specify --to ${FRAMEWORK_VERSION}`);
      if (!resourcesDir) throw new Error("Packaged resources are unavailable");
      const resources = loadResources(resourcesDir);
      if (dryRun) {
        const { changes, ...preview } = planUpdate(root, resources, target ?? FRAMEWORK_VERSION);
        console.log(JSON.stringify(preview, null, 2));
        return preview.actions.some(action => action.action === "conflict") ? 1 : 0;
      }
      console.log(JSON.stringify(applyUpdate(root, resources, target!), null, 2)); return 0;
    }
    if (command === "rollback") {
      if (!args[0] || args.length > 2 || (args[1] && args[1] !== "--dry-run")) throw new Error("Usage: aidlc rollback <transaction-id> [--dry-run]");
      console.log(JSON.stringify(rollback(root, args[0], args[1] === "--dry-run"), null, 2)); return 0;
    }
    if (command === "init") {
      const options: Record<string, string> = {};
      for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace(/^--/, "");
        if (!["preset", "harness", "governance"].includes(key) || !args[i].startsWith("--") || !args[i + 1] || args[i + 1].startsWith("--") || key in options) throw new Error(`Invalid init option: ${args[i]}`);
        options[key] = args[i + 1];
      }
      if (!resourcesDir) throw new Error("Packaged resources are unavailable");
      // Load a fixed packaged resource set, never instructions supplied by the target project.
      const result = initialize(root, loadResources(resourcesDir), options);
      for (const path of result.created) console.log(`Created ${path}`);
      for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
      for (const error of result.errors) console.error(`Error: ${error}`);
      if (!result.errors.length) console.log(result.existing ? "AIDLC already initialized; no files changed." : "AIDLC initialized.");
      return result.errors.length ? 1 : 0;
    }
    if (command === "doctor") {
      if (args.length) throw new Error("doctor does not accept arguments");
      const result = inspectProject(root);
      console.log("AI-DLC Doctor");
      for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
      for (const error of result.errors) console.error(`Error: ${error}`);
      if (!result.errors.length) console.log("AI-DLC doctor completed");
      return result.errors.length ? 1 : 0;
    }
    if (command === "config") {
      if (args.length) throw new Error("config does not accept arguments");
      const config = loadProjectConfig(root);
      const errors = configErrors(config);
      if (errors.length) throw new Error(errors.join("\n"));
      console.log(JSON.stringify(config, null, 2));
      return 0;
    }
    if (!["setup", "check-setup", "new", "status", "list", "next", "validate", "branch", "transition", "close"].includes(command)) throw new Error(`Unknown command: ${command}. Run aidlc --help.`);
    const incompatible = compatibilityErrors(root, { allowMissingConfig: command === "setup" });
    if (incompatible.length) throw new Error(incompatible.join("\n"));
    // Legacy commands retain their established cwd-based behavior at the CLI boundary.
    process.chdir(root);
    runLegacy([command, ...args]);
    return 0;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally { if (process.cwd() !== originalCwd) process.chdir(originalCwd); }
}
