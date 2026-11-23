#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { runCli } from "./index";
process.exitCode = runCli(process.argv.slice(2), fileURLToPath(new URL("../resources/", import.meta.url)));
