import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "./config";
import { BLOCK_END, BLOCK_START } from "./installation";
import type { Resources } from "./init";
import { agentPath, instructionPath, renderAgent, type Harness, type RoleBinding } from "./harness";

export const INSTRUCTION_BLOCK = `${BLOCK_START}\nRead .aidlc/workflow.md and the active intent before task work. The executable policy is .aidlc/config.yaml. Run aidlc doctor to check the project.\nPreview framework changes with aidlc update --dry-run before applying a target version.\n${BLOCK_END}`;
export const PROJECT_DOCUMENT = "# AIDLC\n\nProject workflow: [.aidlc/workflow.md](.aidlc/workflow.md). Configuration: `.aidlc/config.yaml`.\n";
export function loadResources(directory: string): Resources {
  return {
    workflow: readFileSync(join(directory, "workflow.md"), "utf8"),
    agents: Object.fromEntries(DEFAULT_CONFIG.requiredAgents.map(name => [name + ".toml", readFileSync(join(directory, "codex", name + ".toml"), "utf8")])),
  };
}
export function managedPayload(resources: Resources, harness: Harness = "codex", bindings: Record<string, RoleBinding> = {}): Map<string, { content: string; kind: "file" | "block" }> {
  const files = new Map<string, { content: string; kind: "file" | "block" }>([
    [".aidlc/workflow.md", { content: resources.workflow, kind: "file" }],
    [instructionPath(harness), { content: INSTRUCTION_BLOCK, kind: "block" }],
  ]);
  for (const name of DEFAULT_CONFIG.requiredAgents) {
    const content = resources.agents[name + ".toml"];
    if (typeof content !== "string") throw new Error(`Missing bundled agent: ${name}`);
    files.set(agentPath(harness, name), { content: renderAgent(harness, name, content, bindings[name]), kind: "file" });
  }
  files.set("AIDLC.md", { content: PROJECT_DOCUMENT, kind: "file" });
  return files;
}
