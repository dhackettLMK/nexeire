import { rm } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";

const root = process.cwd();
const entryPoint = path.join(root, "src/remotion/index.ts");
const outDir = path.join(root, ".remotion/bundle");

await rm(outDir, { force: true, recursive: true });

await bundle({
  entryPoint,
  outDir,
  publicDir: null,
  enableCaching: true,
  onProgress: () => undefined,
  ignoreRegisterRootWarning: false,
  keyboardShortcutsEnabled: false,
  askAIEnabled: false,
  symlinkPublicDir: false,
});

console.log(`Remotion bundle written to ${path.relative(root, outDir)}`);
