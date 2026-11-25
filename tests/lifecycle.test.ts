import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CONFIG_YAML } from "../packages/core/config";
import { createIntent, listIntents, showIntent, transitionIntent } from "../packages/core/intents";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let root: string;
const compactConfig = (governance = "standard") => `version: 1
workflow_preset: compact
governance_profile: ${governance}
`;
function write(path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}
function configure(compact = false, governance = "standard") {
  write(".aidlc/config.yaml", compact ? compactConfig(governance) : DEFAULT_CONFIG_YAML.replace("governance_profile: strict", `governance_profile: ${governance}`));
  write(".aidlc/state.json", JSON.stringify({ version: "1.0.0", initialized: true }));
  write("AGENTS.md", "# Agents\n");
  write("AIDLC.md", "# Project\n");
  mkdirSync(join(root, "intents"), { recursive: true });
  mkdirSync(join(root, "docs"), { recursive: true });
  for (const name of ["aidlc-orchestrator", "reader", "planner", "builder", "tester", "reviewer", "documenter"]) write(`.codex/agents/${name}.toml`, `name = "${name}"\n`);
}
function cli(...args: string[]) {
  const result = Bun.spawnSync({ cmd: [process.execPath, join(repo, "scripts/aidlc.ts"), "--cwd", root, ...args], cwd: repo, stdout: "pipe", stderr: "pipe" });
  return { code: result.exitCode, text: result.stdout.toString() + result.stderr.toString() };
}
function full(status = "backlog") {
  return `---
id: INTENT-001
title: Legacy intent
status: ${status}
story_points: 1
retry_count: 0
branch: intent/001-legacy
---

# Description
Deliver a useful change.

# Acceptance Criteria
- [x] Observable behavior works.

# Related Files
- source.ts

# Test Notes
Validation passed.

# Review Notes
APPROVED by independent reviewer.
`;
}
function compact(status = "backlog") {
  return `---
id: INTENT-small
schema: compact-v1
title: Compact intent
type: feature
status: ${status}
branch: intent/small-change
---

# Objective
Deliver a useful change.

# Scope
One local feature.

# Acceptance Criteria
- [x] Observable behavior works.

# Plan
Implement and validate the feature.

# Validation
Automated validation passed; no pending checks.

# Review
APPROVED by independent reviewer.
`;
}
function branch(name: string) { write(".git/HEAD", `ref: refs/heads/${name}\n`); }
function intent(path = "INTENT-small.md") { return readFileSync(join(root, "intents", path), "utf8"); }
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "aidlc lifecycle ")); });
afterEach(() => {
  if (resolve(root).startsWith(resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/"))) rmSync(root, { recursive: true, force: true });
});

describe("shared lifecycle", () => {
  test("Core operations target explicit project roots without changing cwd", () => {
    configure();
    const other = join(root, "other project");
    write("other project/.aidlc/config.yaml", compactConfig());
    const cwd = process.cwd();
    const first = createIntent(root, "Full root");
    const second = createIntent(other, "Compact root", { type: "experiment" });
    expect(process.cwd()).toBe(cwd);
    expect(listIntents(root).map(item => item.id)).toEqual([first.id]);
    expect(listIntents(other).map(item => item.id)).toEqual([second.id]);
    expect(showIntent(other, second.id).schema).toBe("compact-v1");
    expect(() => transitionIntent(other, second.id, "done")).toThrow();
    expect(showIntent(other, second.id).status).toBe("backlog");
    expect(process.cwd()).toBe(cwd);
  });
  test("direct Core writes reject unconfigured projects before creating files", () => {
    expect(() => createIntent(root, "Unsafe implicit setup")).toThrow();
    expect(existsSync(join(root, "intents"))).toBe(false);
  });
  test("modern and legacy creation/list/show share the same intent storage", () => {
    configure();
    expect(cli("intent", "new", "Modern title").code).toBe(0);
    expect(cli("new", "Legacy title").code).toBe(0);
    expect(cli("new").code).toBe(0);
    const files = readdirSync(join(root, "intents"));
    expect(files).toHaveLength(3);
    expect(cli("intent", "list")).toEqual(cli("list"));
    expect(cli("intent", "status")).toEqual(cli("status"));
    const shown = cli("intent", "show", files[0]);
    expect(shown.code).toBe(0);
    const record = JSON.parse(shown.text);
    expect(record.id).toMatch(/^INTENT-/);
    expect(record.schema).toBe("full-v1");
    expect(record.content).toBe(readFileSync(join(root, "intents", files[0]), "utf8"));
    expect(cli("intent", "show", record.id)).toEqual(shown);
  });
  test("modern and legacy transitions share readiness, branch and gate checks", () => {
    configure(); write("intents/INTENT-001.md", full());
    expect(cli("intent", "transition", "INTENT-001", "context_ready").code).toBe(0);
    branch("main");
    const before = intent("INTENT-001.md");
    const blocked = cli("intent", "transition", "INTENT-001", "in_development");
    expect(blocked.code).toBe(1);
    expect(blocked.text).toContain("Intent branch mismatch");
    expect(intent("INTENT-001.md")).toBe(before);
    branch("intent/001-legacy");
    expect(cli("branch", "INTENT-001").code).toBe(0);
    const started = cli("transition", "INTENT-001", "in_development");
    expect(started.code).toBe(0);
    expect(started.text).toContain("Approval gate reached");
    expect(cli("intent", "transition", "INTENT-001", "review").code).toBe(1);
    expect(cli("transition", "INTENT-001", "ready_for_testing").code).toBe(0);
  });
  test("compact creation uses compact fields without full-preset bookkeeping", () => {
    configure(true);
    expect(cli("intent", "new", "Compact bug", "--type", "bug").code).toBe(0);
    const file = readdirSync(join(root, "intents"))[0];
    const record = JSON.parse(cli("intent", "show", file).text);
    expect(record.schema).toBe("compact-v1");
    expect(record.content).toContain("type: bug");
    expect(record.content).toContain("# Objective");
    expect(record.content).toContain("# Validation");
    expect(record.content).not.toContain("story_points:");
    expect(record.content).not.toContain("retry_count:");
    expect(cli("validate").code).toBe(0);
    expect(cli("doctor").code).toBe(0);
    expect(cli("intent", "new", "Bad type", "--type", "surprise").code).toBe(1);
    expect(readdirSync(join(root, "intents"))).toHaveLength(1);
  });
  for (const governance of ["strict", "standard", "autonomous"]) {
    test(`compact workflow respects ${governance} governance independently`, () => {
      configure(true, governance); write("intents/INTENT-small.md", compact());
      branch("intent/small-change");
      for (const state of ["context_ready", "in_development", "review", "done"]) {
        const result = cli("intent", "transition", "INTENT-small", state);
        expect(result.code).toBe(0);
        const gated = governance === "strict" || state === "done" || (governance === "standard" && state === "in_development");
        expect(result.text.includes("Approval gate reached")).toBe(gated);
      }
      expect(intent()).toContain("status: done");
      expect(cli("intent", "transition", "INTENT-small", "backlog").code).toBe(1);
      expect(cli("close", "INTENT-small", "stale").code).toBe(1);
    });
  }
  test("compact readiness requires scope and plan without mutating rejected intents", () => {
    configure(true);
    for (const heading of ["Objective", "Scope", "Plan"]) {
      const content = compact().replace(new RegExp(`# ${heading}\\n[^#]+`), `# ${heading}\n\n`);
      write("intents/INTENT-small.md", content);
      expect(cli("transition", "INTENT-small", "context_ready").code).toBe(1);
      expect(intent()).toBe(content);
    }
  });
  test("compact completion refuses unchecked acceptance, missing evidence and rejected review", () => {
    configure(true);
    for (const content of [
      compact("review").replace("[x]", "[ ]"),
      compact("review").replace("Automated validation passed; no pending checks.", ""),
      compact("review").replace("APPROVED by independent reviewer.", "REJECTED. Not approved."),
    ]) {
      write("intents/INTENT-small.md", content);
      expect(cli("transition", "INTENT-small", "done").code).toBe(1);
      expect(intent()).toBe(content);
    }
  });
  test("compact supports explicit rework, escalation and closing without completion evidence", () => {
    configure(true); write("intents/INTENT-small.md", compact("review"));
    branch("intent/small-change");
    expect(cli("transition", "INTENT-small", "in_development").code).toBe(0);
    expect(cli("transition", "INTENT-small", "escalated").code).toBe(0);
    expect(cli("transition", "INTENT-small", "backlog").code).toBe(0);
    const result = cli("close", "INTENT-small", "superseded");
    expect(result.code).toBe(0);
    expect(intent()).toContain("status: closed");
    expect(intent()).toContain("closed_reason: superseded");
    expect(cli("transition", "INTENT-small", "backlog").code).toBe(1);
  });
  test("full completion honors the latest approval while preserving rejection history", () => {
    configure();
    const content = full("approved").replace("APPROVED by independent reviewer.", "## Cycle 1\nREJECTED. Missing evidence.\n\n## Cycle 2\nAPPROVED by independent reviewer.");
    write("intents/INTENT-001.md", content);
    expect(cli("transition", "INTENT-001", "done").code).toBe(0);
    expect(intent("INTENT-001.md")).toContain("REJECTED. Missing evidence.");
    expect(intent("INTENT-001.md")).toContain("status: done");
  });
  test("unsupported preset/schema pairs fail before writes", () => {
    configure(true); write("intents/INTENT-small.md", compact());
    const before = intent();
    for (const config of [
      "version: 1\nworkflow_preset: missing\n",
      compactConfig() + "intent_schema: full-v1\n",
      compactConfig() + "intent_schema: compact-v9\n",
      compactConfig().replace("version: 1", "version: 99"),
    ]) {
      write(".aidlc/config.yaml", config);
      expect(cli("new", "Do not create").code).toBe(1);
      expect(cli("transition", "INTENT-small", "context_ready").code).toBe(1);
      expect(intent()).toBe(before);
      expect(readdirSync(join(root, "intents"))).toHaveLength(1);
    }
  });
  test("unknown per-intent schemas cannot transition or validate", () => {
    configure(true);
    const content = compact().replace("compact-v1", "compact-v99");
    write("intents/INTENT-small.md", content);
    expect(cli("validate").code).toBe(1);
    expect(cli("transition", "INTENT-small", "context_ready").code).toBe(1);
    expect(intent()).toBe(content);
  });
  test("empty metadata and duplicate status fields cannot borrow body values or be rewritten", () => {
    configure(true);
    for (const content of [
      compact().replace("title: Compact intent", "title:"),
      compact().replace("status: backlog", "status: backlog\nstatus: review"),
      compact().replace("schema: compact-v1", "schema: compact-v1\nschema: full-v1"),
    ]) {
      write("intents/INTENT-small.md", content);
      expect(cli("validate").code).toBe(1);
      expect(cli("transition", "INTENT-small", "context_ready").code).toBe(1);
      expect(intent()).toBe(content);
    }
  });
  test("status and close updates preserve literal dollar tokens in titles and reasons", () => {
    configure(true);
    const title = "Handle $& and $` and $' and $$ literally";
    const content = compact().replace("Compact intent", () => title);
    write("intents/INTENT-small.md", content);
    expect(cli("transition", "INTENT-small", "context_ready").code).toBe(0);
    expect(intent()).toBe(content.replace("status: backlog", "status: context_ready"));
    const reason = "superseded $& $` $' $$";
    expect(cli("close", "INTENT-small", reason).code).toBe(0);
    const closed = intent();
    expect(closed).toContain(`title: ${title}`);
    expect(closed).toContain(`closed_reason: ${reason}`);
    expect(closed.match(/^status:/gm)).toHaveLength(1);
    const revisedReason = "revised $& $` $' $$";
    expect(cli("close", "INTENT-small", revisedReason).code).toBe(0);
    expect(intent()).toContain(`closed_reason: ${revisedReason}`);
    expect(intent().match(/^closed_reason:/gm)).toHaveLength(1);
    expect(cli("validate").code).toBe(0);
  });
  test("invalid configured workflow graphs and omitted required roles fail before writes", () => {
    configure(true);
    for (const config of [
      compactConfig() + "agents:\n  required:\n    - builder\n",
      compactConfig() + "lifecycle:\n  transitions:\n    done:\n      - backlog\n",
      compactConfig() + "lifecycle:\n  transitions:\n    in_development:\n      - done\n",
      compactConfig() + "lifecycle:\n  terminal_statuses:\n    - closed\n",
      compactConfig() + "lifecycle:\n  transitions: invalid\n",
      compactConfig() + "lifecycle:\n  transitions:\n    backlog: [done]\n",
      compactConfig() + "agents: []\n",
      compactConfig() + "governance_profiles:\n  standard:\n    approval_gates: [done]\n",
    ]) {
      write(".aidlc/config.yaml", config);
      expect(cli("new", "Do not create").code).toBe(1);
      expect(readdirSync(join(root, "intents"))).toHaveLength(0);
    }
  });
  test("terminal full history keeps its schema, identifiers and bytes under compact", () => {
    configure(true);
    for (const state of ["done", "closed"]) write(`intents/INTENT-old-${state}.md`, full(state).replace("INTENT-001", `INTENT-old-${state}`));
    const before = readdirSync(join(root, "intents")).map(file => [file, intent(file)]);
    expect(cli("validate").code).toBe(0);
    expect(cli("intent", "new", "New compact work").code).toBe(0);
    for (const [file, content] of before) {
      const shown = cli("intent", "show", file);
      expect(shown.code).toBe(0);
      expect(JSON.parse(shown.text).schema).toBe("full-v1");
      expect(intent(file)).toBe(content);
    }
    expect(cli("next").text).not.toContain("INTENT-old-");
  });
  test("unsupported active full states are not silently mapped under compact", () => {
    configure(true); const content = full("approved"); write("intents/INTENT-001.md", content);
    expect(cli("intent", "show", "INTENT-001").code).toBe(0);
    const result = cli("transition", "INTENT-001", "done");
    expect(result.code).toBe(1);
    expect(result.text).toMatch(/preset|migrat|default/i);
    expect(intent("INTENT-001.md")).toBe(content);
    expect(cli("close", "INTENT-001", "abandoned").code).toBe(0);
  });
  test("read commands do not recreate a missing intents directory", () => {
    configure(); rmSync(join(root, "intents"), { recursive: true });
    for (const args of [["list"], ["intent", "list"], ["status"], ["next"], ["intent", "show", "missing"]]) {
      cli(...args);
      expect(existsSync(join(root, "intents"))).toBe(false);
    }
  });
  test("invalid modern arguments do not create intents or modify existing files", () => {
    configure(true); write("intents/INTENT-001.md", full()); const before = intent("INTENT-001.md");
    for (const args of [["intent", "new"], ["intent", "new", ""], ["intent", "new", "--type", "bug"], ["intent", "new", "Title", "--wat"], ["intent", "list", "extra"], ["intent", "show"], ["intent", "transition", "INTENT-001", "context_ready", "extra"]]) expect(cli(...args).code).toBe(1);
    expect(readdirSync(join(root, "intents"))).toHaveLength(1);
    expect(intent("INTENT-001.md")).toBe(before);
  });
});
