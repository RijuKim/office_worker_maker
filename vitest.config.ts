import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
      "tests/acceptance/**/*.test.ts",
      "tests/acceptance/**/*.test.tsx",
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
    ],
  },
});
