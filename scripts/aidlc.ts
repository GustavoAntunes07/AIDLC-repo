import { runCli } from "../packages/cli/index";
import { fileURLToPath } from "node:url";
process.exitCode = runCli(process.argv.slice(2), fileURLToPath(new URL("../resources/", import.meta.url)));
