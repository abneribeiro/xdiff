import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Builds the browser UI (Monaco) from src/web into dist/web, which the
// Node server serves as static files.
export default defineConfig({
  root: resolve(__dirname, "src/web"),
  base: "./",
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "dist/web"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4096,
  },
});
