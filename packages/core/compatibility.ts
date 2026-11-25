import { existsSync, readFileSync } from "node:fs";
import { configErrors, loadProjectConfig } from "./config";
import { pendingTransactionId, processExists, readManifest, readUpdateLock, safePath } from "./installation";

/** Read-only guard shared by CLI commands, including legacy commands that may create directories. */
export function compatibilityErrors(root: string, options: { allowMissingConfig?: boolean; ignoreUpdateLock?: boolean } = {}): string[] {
  const errors: string[] = [];
  try {
    const pending = pendingTransactionId(root);
    if (pending) return [`Interrupted update ${pending}; recover with aidlc update --recover ${pending}`];
    const lock = readUpdateLock(root);
    if (lock && !options.ignoreUpdateLock && lock.pid !== process.pid) return [processExists(lock.pid)
      ? `Another update/recovery process is active for ${lock.id}`
      : `Abandoned update lock ${lock.id}; recover with aidlc update --recover ${lock.id}`];
    const manifest = readManifest(root);
    const configPath = safePath(root, ".aidlc/config.yaml");
    if (existsSync(configPath)) {
      const config = loadProjectConfig(root);
      errors.push(...configErrors(config));
      if (manifest && manifest.harness !== config.harness) errors.push(`Configured harness ${config.harness} differs from installed harness ${manifest.harness}; revert the harness setting`);
    }
    else if (!options.allowMissingConfig || manifest) errors.push("Missing .aidlc/config.yaml; run aidlc init or complete legacy setup before changing the project");

    const statePath = safePath(root, ".aidlc/state.json");
    if (existsSync(statePath)) {
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      if (state?.initialized !== true || state?.version !== "1.0.0") errors.push("Unsupported or invalid project state; migration required");
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return errors;
}
