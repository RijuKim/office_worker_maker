import { defineConfig, devices } from '@playwright/test';

const runId = process.env.PLAYWRIGHT_RUN_ID || `${process.pid}`;
const nextDistDir = `.next-playwright-${runId}`;
const evidenceDir = `.tenet/runs/2026-07-22-toss-ui-unification/evidence/${runId}`;

export default defineConfig({
  testDir: './tests/acceptance',
  testMatch: '**/*.spec.ts',
  // Several acceptance specs own auxiliary Vite servers on fixed ports. Running
  // those specs concurrently lets one worker tear down a server another worker
  // is still using, which can strand the run without a useful final report.
  workers: 1,
  fullyParallel: false,
  // The full matrix is intentionally serialized because a few specs own fixed
  // auxiliary Vite ports. Give both browser projects enough time to finish;
  // the previous ten-minute cap interrupted the suite before cleanup/reporting.
  globalTimeout: 30 * 60_000,
  reporter: [
    ['list'],
    ['json', { outputFile: `${evidenceDir}/playwright-report.json` }],
  ],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    // Keep server startup independent from the availability of the remote
    // development database. Database-backed specs should report connectivity or
    // schema failures as test results instead of preventing every browser and
    // smoke test from reaching Next.js.
    // Webpack's single long-lived dev process is materially more stable for the
    // serialized database suite than Turbopack's transient worker pool.
    command: `NEXT_DIST_DIR=${nextDistDir} npm run dev -- --webpack`,
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  outputDir: `${evidenceDir}/screenshots-and-traces`,
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
