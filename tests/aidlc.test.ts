import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(repoRoot, "scripts", "aidlc.ts");
const configPath = join(repoRoot, ".aidlc", "config.yaml");

let workspace = "";

function runAidlc(args: string[]) {
  return Bun.spawnSync({
    cmd: [process.execPath, cliPath, ...args],
    cwd: workspace,
    stdout: "pipe",
    stderr: "pipe",
  });
}

function output(result: ReturnType<typeof runAidlc>) {
  return `${result.stdout.toString()}${result.stderr.toString()}`;
}

function writeFile(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function createConfiguredProject() {
  mkdirSync(join(workspace, ".aidlc"), { recursive: true });
  mkdirSync(join(workspace, ".codex", "agents"), { recursive: true });
  mkdirSync(join(workspace, "docs"), { recursive: true });
  mkdirSync(join(workspace, "intents"), { recursive: true });

  writeFile(join(workspace, "AGENTS.md"), "# Agents\n");
  writeFile(join(workspace, "AIDLC.md"), "# AI-DLC\n");
  writeFile(
    join(workspace, ".aidlc", "state.json"),
    JSON.stringify({ version: "1.0.0", initialized: true }, null, 2),
  );
  writeFile(join(workspace, ".aidlc", "config.yaml"), readFileSync(configPath, "utf-8"));

  for (const agent of [
    "aidlc-orchestrator",
    "reader",
    "planner",
    "builder",
    "tester",
    "reviewer",
    "documenter",
  ]) {
    writeFile(join(workspace, ".codex", "agents", `${agent}.toml`), `name = "${agent}"\n`);
  }
}

function setCurrentBranch(branch: string) {
  writeFile(join(workspace, ".git", "HEAD"), `ref: refs/heads/${branch}\n`);
}

function createBranch(branch: string) {
  writeFile(join(workspace, ".git", "refs", "heads", ...branch.split("/")), "abc123\n");
}

function writeIntent(status: string, options: { omitCommitsHeading?: boolean } = {}) {
  writeFile(
    join(workspace, "intents", "INTENT-001.md"),
    `---
id: INTENT-001
title: Test intent
status: ${status}
story_points: 1
retry_count: 0
branch: intent/001-test-intent
---

# Description

Test the lifecycle.

# Acceptance Criteria

- [x] It works

# Related Files

- scripts/aidlc.ts

# Implementation Notes

# Test Notes

- Tests passed.

# Review Notes

Approved by reviewer.
${options.omitCommitsHeading ? "" : `
# Commits
`}
`,
  );
}

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "aidlc-test-"));
});

afterEach(() => {
  if (workspace && existsSync(workspace)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("AI-DLC CLI", () => {
  test("setup creates state and config files", () => {
    const result = runAidlc(["setup"]);

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(workspace, ".aidlc", "state.json"))).toBe(true);
    expect(existsSync(join(workspace, ".aidlc", "config.yaml"))).toBe(true);
  });

  test("doctor validates config, required agents, and intents", () => {
    createConfiguredProject();
    writeIntent("ready_for_testing");

    const result = runAidlc(["doctor"]);

    expect(result.exitCode).toBe(0);
    expect(output(result)).toContain("AI-DLC doctor completed");
  });

  test("doctor fails when a required agent is missing", () => {
    createConfiguredProject();
    writeIntent("ready_for_testing");
    rmSync(join(workspace, ".codex", "agents", "reviewer.toml"));

    const result = runAidlc(["doctor"]);

    expect(result.exitCode).toBe(1);
    expect(output(result)).toContain("Missing required agent");
  });

  test("transition blocks invalid lifecycle jumps", () => {
    createConfiguredProject();
    setCurrentBranch("intent/001-test-intent");
    writeIntent("in_development");

    const result = runAidlc(["transition", "INTENT-001", "done"]);

    expect(result.exitCode).toBe(1);
    expect(output(result)).toContain("Invalid transition");
  });

  test("transition updates status and reports approval gates", () => {
    createConfiguredProject();
    setCurrentBranch("intent/001-test-intent");
    writeIntent("ready_for_testing");

    const result = runAidlc(["transition", "INTENT-001", "review"]);
    const updatedIntent = readFileSync(
      join(workspace, "intents", "INTENT-001.md"),
      "utf-8",
    );

    expect(result.exitCode).toBe(0);
    expect(output(result)).toContain("Approval gate reached");
    expect(updatedIntent).toContain("status: review");
  });

  test("transition to done reads review notes at end of file", () => {
    createConfiguredProject();
    setCurrentBranch("intent/001-test-intent");
    writeIntent("approved", { omitCommitsHeading: true });

    const result = runAidlc(["transition", "INTENT-001", "done"]);
    const updatedIntent = readFileSync(
      join(workspace, "intents", "INTENT-001.md"),
      "utf-8",
    );

    expect(result.exitCode).toBe(0);
    expect(updatedIntent).toContain("status: done");
  });

  test("branch reports when current branch matches the intent branch", () => {
    createConfiguredProject();
    setCurrentBranch("intent/001-test-intent");
    createBranch("intent/001-test-intent");
    writeIntent("context_ready");

    const result = runAidlc(["branch", "INTENT-001"]);

    expect(result.exitCode).toBe(0);
    expect(output(result)).toContain("Intent branch exists: yes");
    expect(output(result)).toContain("Branch status: ok");
  });

  test("transition to development suggests switching to an existing branch", () => {
    createConfiguredProject();
    setCurrentBranch("main");
    createBranch("intent/001-test-intent");
    writeIntent("context_ready");

    const result = runAidlc(["transition", "INTENT-001", "in_development"]);

    expect(result.exitCode).toBe(1);
    expect(output(result)).toContain("Intent branch mismatch");
    expect(output(result)).toContain("git switch intent/001-test-intent");
  });

  test("transition to development suggests creating a missing branch", () => {
    createConfiguredProject();
    setCurrentBranch("main");
    writeIntent("context_ready");

    const result = runAidlc(["transition", "INTENT-001", "in_development"]);

    expect(result.exitCode).toBe(1);
    expect(output(result)).toContain("Intent branch mismatch");
    expect(output(result)).toContain("git switch -c intent/001-test-intent");
  });
});
