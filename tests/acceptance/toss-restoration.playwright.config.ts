import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "toss-restoration-review.spec.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: { trace: "on-first-retry" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
