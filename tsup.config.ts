import { defineConfig } from "tsup";

// Bundles the CLI + server into dist/cli.js. Runtime dependencies
// (chokidar, ws, web-tree-sitter, tree-sitter-wasms, ...) are kept external
// by tsup's default behavior, so their .wasm/native assets load from
// node_modules at runtime via createRequire resolution.
export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  target: "node18",
  platform: "node",
  clean: false,
  sourcemap: true,
  dts: false,
  banner: { js: "#!/usr/bin/env node" },
});
