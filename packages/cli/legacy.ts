import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_CONFIG_YAML } from "../core/config";
import { inspectProject } from "../core/project";
import { safePath } from "../core/installation";
import { checkIntentBranch, closeIntent, createIntent, intentStatus, listIntents, nextIntent, showIntent, transitionIntent, validateProjectIntents } from "../core/intents";

function gate(result: { approvalRequired: boolean; profile: string }) {
  if (result.approvalRequired) console.log(`Approval gate reached for governance profile: ${result.profile}`);
}
export function runLegacy(argv: string[], root = process.cwd(), options: { requireTitle?: boolean } = {}) {
  const [command, ...args] = argv;
  switch (command) {
    case "setup": {
      if (args.length) throw new Error("setup does not accept arguments");
      for (const dir of ["intents", "docs", ".codex", ".codex/agents", ".aidlc"]) mkdirSync(safePath(root, dir), { recursive: true });
      const state = safePath(root, ".aidlc/state.json");
      if (!existsSync(state)) writeFileSync(state, JSON.stringify({ version: "1.0.0", initialized: true, created_at: new Date().toISOString() }, null, 2));
      const config = safePath(root, ".aidlc/config.yaml");
      if (!existsSync(config)) writeFileSync(config, DEFAULT_CONFIG_YAML);
      console.log("AI-DLC structure initialized"); return;
    }
    case "check-setup": {
      if (args.length) throw new Error("check-setup does not accept arguments");
      const result = inspectProject(root, { intents: false });
      if (result.errors.length) throw new Error("AI-DLC setup incomplete\n" + result.errors.join("\n"));
      console.log("AI-DLC setup complete"); return;
    }
    case "new": {
      let type: string | undefined;
      const title: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "--type" && type === undefined && args[i + 1] && !args[i + 1].startsWith("--")) type = args[++i];
        else if (args[i].startsWith("--")) throw new Error(`Invalid intent new option: ${args[i]}`);
        else title.push(args[i]);
      }
      const titleText = title.join(" ");
      if (options.requireTitle && !titleText.trim()) throw new Error("Usage: aidlc intent new <title> [--type feature|bug|experiment]");
      const intent = createIntent(root, titleText || "Untitled intent", { type });
      console.log(`Created ${intent.file}`); return;
    }
    case "status": {
      if (args.length) throw new Error("status does not accept arguments");
      console.log("\nAI-DLC Status\n");
      for (const [key, count] of Object.entries(intentStatus(root))) console.log(`${key}: ${count}`);
      return;
    }
    case "list": {
      if (args.length) throw new Error("list does not accept arguments");
      for (const intent of listIntents(root)) console.log(`${intent.id} | ${intent.status} | ${intent.title}`);
      return;
    }
    case "show": {
      if (args.length !== 1) throw new Error("Usage: aidlc intent show <intent-id|file>");
      console.log(JSON.stringify(showIntent(root, args[0]), null, 2)); return;
    }
    case "next": {
      if (args.length) throw new Error("next does not accept arguments");
      const intent = nextIntent(root);
      if (!intent) console.log("No pending intents found.");
      else { const { content, schema, ...summary } = intent; console.log(JSON.stringify(summary, null, 2)); }
      return;
    }
    case "validate": {
      if (args.length) throw new Error("validate does not accept arguments");
      const errors = validateProjectIntents(root);
      if (errors.length) throw new Error(errors.join("\n"));
      console.log("All intents are valid"); return;
    }
    case "transition": {
      if (args.length !== 2) throw new Error("Usage: aidlc transition <intent-id|file> <target-status>");
      const result = transitionIntent(root, args[0], args[1]);
      console.log(`Transitioned ${args[0]}: ${result.from} -> ${result.to}`); gate(result); return;
    }
    case "close": {
      if (!args[0]) throw new Error("Usage: aidlc close <intent-id|file> [reason]");
      const reason = args.slice(1).join(" ");
      const result = closeIntent(root, args[0], reason);
      console.log(`Closed ${args[0]}${reason ? `: ${reason}` : ""}`); gate(result); return;
    }
    case "branch": {
      if (args.length !== 1) throw new Error("Usage: aidlc branch <intent-id|file>");
      const result = checkIntentBranch(root, args[0]);
      console.log(`Intent branch: ${result.requiredBranch}`);
      console.log(`Intent branch exists: ${result.exists ? "yes" : "no"}`);
      console.log(`Current branch: ${result.currentBranch ?? "unknown"}`);
      console.log(`Branch status: ${result.matches ? "ok" : "mismatch"}`);
      if (!result.matches) throw new Error(`Run: ${result.suggestion}`);
      return;
    }
    default: throw new Error(`Unknown lifecycle command: ${command}`);
  }
}
