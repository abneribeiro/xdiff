import { defineConfig } from "vitest/config";

export default defineConfig({
  // Source uses NodeNext ".js" specifiers; map them to the real ".ts" files.
  resolve: { extensionAlias: { ".js": [".ts", ".js"] } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000,
  },
});
