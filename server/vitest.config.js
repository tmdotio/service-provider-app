import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.js"],
    // Each file starts its own in-memory MongoDB; run them one by one
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
