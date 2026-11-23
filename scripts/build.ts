import { mkdirSync } from "node:fs";
mkdirSync("dist", { recursive: true });
const result = await Bun.build({
  entrypoints: ["packages/cli/bin.ts"],
  outdir: "dist",
  naming: "aidlc.js",
  target: "node",
  format: "esm",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exitCode = 1;
}
