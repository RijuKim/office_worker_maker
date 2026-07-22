import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const runId = process.env.PLAYWRIGHT_RUN_ID || "retry4-restoration";
const evidenceDir = resolve(process.cwd(), `.tenet/runs/2026-07-22-toss-ui-unification/evidence/${runId}`);

export default defineConfig({
  testDir: ".",
  testMatch: "toss-restoration-review.spec.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["json", { outputFile: `${evidenceDir}/playwright-report.json` }]],
  outputDir: `${evidenceDir}/screenshots-and-traces`,
  use: { trace: "on-first-retry", screenshot: "only-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
