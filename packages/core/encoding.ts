import { isUtf8 } from "node:buffer";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

/** Refuse destructive decoding; UTF-16 without a BOM can otherwise look like valid UTF-8. */
export function readUtf8Instructions(path: string): string {
  const bytes = readFileSync(path);
  if (!isUtf8(bytes) || bytes.includes(0)) {
    throw new Error(`Unsupported text encoding in ${basename(path)}; expected UTF-8. Convert the file explicitly before initialization.`);
  }
  return bytes.toString("utf8");
}
