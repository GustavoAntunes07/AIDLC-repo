export type Harness = "codex" | "claude";
export type RoleBinding = { model?: string; reasoning?: string };

export const ROLE_NAMES = ["aidlc-orchestrator", "reader", "planner", "builder", "tester", "reviewer", "documenter", "reviewer-specialist"];
const CODEX_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"];
const CLAUDE_EFFORTS = ["low", "medium", "high", "max"];

export function isHarness(value: unknown): value is Harness {
  return value === "codex" || value === "claude";
}

function requireRole(role: string): void {
  if (!ROLE_NAMES.includes(role)) throw new Error(`Unsupported role binding: ${role}`);
}

export function agentPath(harness: Harness, role: string): string {
  if (!/^[a-z][a-z0-9-]*$/.test(role)) throw new Error(`Invalid agent identifier: ${role}`);
  return `.${harness}/agents/${role}.${harness === "codex" ? "toml" : "md"}`;
}

export function instructionPath(harness: Harness): string {
  return harness === "codex" ? "AGENTS.md" : "CLAUDE.md";
}

export function bindingErrors(harness: Harness, role: string, binding: RoleBinding): string[] {
  const errors: string[] = [];
  if (!ROLE_NAMES.includes(role)) errors.push(`Unsupported role binding: ${role}`);
  if (binding.model !== undefined && (!binding.model.trim() || /[\r\n\x00-\x1f]/.test(binding.model))) errors.push(`Invalid model identifier for ${role}`);
  const efforts = harness === "codex" ? CODEX_EFFORTS : CLAUDE_EFFORTS;
  if (binding.reasoning !== undefined && !efforts.includes(binding.reasoning)) errors.push(`Unsupported ${harness} reasoning setting for ${role}: ${binding.reasoning}`);
  return errors;
}

function canonicalField(text: string, field: string): string {
  const match = text.match(new RegExp(`^${field} = ("(?:[^"\\\\]|\\\\.)*")\\s*$`, "m"));
  if (!match) throw new Error(`Canonical agent is missing ${field}`);
  return JSON.parse(match[1]);
}

export function roleBinding(harness: Harness, role: string, canonicalToml: string, override: RoleBinding = {}): Required<RoleBinding> {
  requireRole(role);
  const specialist = role === "reviewer-specialist";
  let model = canonicalField(canonicalToml, "model");
  if (harness === "claude") model = ["aidlc-orchestrator", "reader", "documenter"].includes(role) ? "haiku" : "sonnet";
  if (specialist) model = harness === "codex" ? "gpt-6.2-astra" : "opus";
  const binding = {
    model: override.model ?? model,
    reasoning: override.reasoning ?? (specialist ? "high" : canonicalField(canonicalToml, "model_reasoning_effort")),
  };
  const errors = bindingErrors(harness, role, binding);
  if (errors.length) throw new Error(errors.join("\n"));
  return binding;
}

export function renderAgent(harness: Harness, role: string, canonicalToml: string, override: RoleBinding = {}): string {
  const binding = roleBinding(harness, role, canonicalToml, override);
  if (harness === "codex") {
    if (canonicalField(canonicalToml, "name") === role && canonicalField(canonicalToml, "model") === binding.model && canonicalField(canonicalToml, "model_reasoning_effort") === binding.reasoning) return canonicalToml;
    return canonicalToml
      .replace(/^name = .*$/m, () => `name = ${JSON.stringify(role)}`)
      .replace(/^model = .*$/m, () => `model = ${JSON.stringify(binding.model)}`)
      .replace(/^model_reasoning_effort = .*$/m, () => `model_reasoning_effort = ${JSON.stringify(binding.reasoning)}`);
  }
  const instructions = canonicalToml.match(/developer_instructions = """\r?\n([\s\S]*?)\r?\n"""/);
  if (!instructions) throw new Error("Canonical agent is missing developer instructions");
  const body = instructions[1].replaceAll("AGENTS.md", "CLAUDE.md");
  return `---\nname: ${JSON.stringify(role)}\ndescription: ${JSON.stringify(canonicalField(canonicalToml, "description"))}\nmodel: ${JSON.stringify(binding.model)}\neffort: ${JSON.stringify(binding.reasoning)}\n---\n\n${body}\n`;
}
